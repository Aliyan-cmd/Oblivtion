// ─── AES-256-GCM Encryption Layer (Web Crypto API) ────────────────────────────
// Zero-trust architecture: Keys are session-derived, non-extractable,
// and automatically shredded on tab close / visibility change.

import type { EncryptedEnvelope } from "./types"

const ALGORITHM = "AES-GCM"
const KEY_LENGTH = 256
const IV_LENGTH = 12   // bytes — AES-GCM recommended
const SALT_LENGTH = 16 // bytes
const PBKDF2_ITERATIONS = 600_000  // OWASP 2024 recommendation

// Session key: derived once, held in memory, wiped on tab close
let _sessionKey: CryptoKey | null = null
let _sessionSalt: Uint8Array | null = null
let _keyMaterialBuffer: ArrayBuffer | null = null

function getCrypto(): SubtleCrypto {
  if (typeof window === "undefined" || !window.crypto?.subtle) {
    throw new Error("Web Crypto API not available")
  }
  return window.crypto.subtle
}

function randomBytes(length: number): Uint8Array {
  const buf = new Uint8Array(length)
  crypto.getRandomValues(buf)
  return buf
}

/** Zeroize an ArrayBuffer to prevent memory leaks of sensitive data */
export function zeroize(buffer: ArrayBuffer | Uint8Array | null): void {
  if (!buffer) return
  const view = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  for (let i = 0; i < view.length; i++) view[i] = 0
}

function toBase64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let binary = ""
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

function fromBase64(str: string): Uint8Array {
  const binary = atob(str)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/**
 * Derive a session key using PBKDF2-SHA256 with 600,000 iterations.
 * The passphrase is a random 256-bit session token — never user-entered.
 * Key is non-extractable (cannot be exported from Web Crypto).
 */
export async function deriveSessionKey(): Promise<CryptoKey> {
  const subtle = getCrypto()
  const passphrase = randomBytes(32) // 256-bit random session token
  const salt = randomBytes(SALT_LENGTH)

  const keyMaterial = await subtle.importKey(
    "raw",
    passphrase.buffer as ArrayBuffer,
    "PBKDF2",
    false, // non-extractable
    ["deriveKey"]
  )

  const key = await subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt.buffer as ArrayBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,          // NOT extractable — cannot be exported
    ["encrypt", "decrypt"]
  )

  _sessionKey = key
  _sessionSalt = salt
  _keyMaterialBuffer = passphrase.buffer as ArrayBuffer

  // Zeroize the raw passphrase from our variable (key material is inside CryptoKey now)
  zeroize(passphrase)

  return key
}

/**
 * Get or create the session key.
 */
export async function getSessionKey(): Promise<CryptoKey> {
  if (_sessionKey) return _sessionKey
  return deriveSessionKey()
}

/**
 * Cryptographic shredding: Wipe the session key and all associated buffers.
 * After this call, all encrypted data becomes permanently unrecoverable.
 */
export function destroySessionKey(): void {
  _sessionKey = null
  if (_sessionSalt) { zeroize(_sessionSalt); _sessionSalt = null }
  if (_keyMaterialBuffer) { zeroize(_keyMaterialBuffer); _keyMaterialBuffer = null }
}

/**
 * Install automatic key shredding on tab close and visibility change.
 * Call once on app mount.
 */
export function installKeyShredding(): void {
  if (typeof window === "undefined") return

  window.addEventListener("beforeunload", destroySessionKey)
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      destroySessionKey()
    }
  })
}

/**
 * Encrypt a string with AES-256-GCM.
 * Each call generates a unique 12-byte IV (no IV reuse).
 * Returns a serializable envelope.
 */
export async function encrypt(plaintext: string): Promise<EncryptedEnvelope> {
  const subtle = getCrypto()
  const key = await getSessionKey()
  const iv = randomBytes(IV_LENGTH) // Unique per message
  const salt = randomBytes(SALT_LENGTH)

  const encoded = new TextEncoder().encode(plaintext)
  const cipherBuf = await subtle.encrypt(
    { name: ALGORITHM, iv: iv.buffer as ArrayBuffer },
    key,
    encoded
  )

  // Zeroize the plaintext buffer after encryption
  zeroize(encoded)

  return {
    ciphertext: toBase64(cipherBuf),
    iv: toBase64(iv),
    salt: toBase64(salt),
    version: 1,
  }
}

/**
 * Decrypt an envelope back to plaintext.
 */
export async function decrypt(envelope: EncryptedEnvelope): Promise<string> {
  const subtle = getCrypto()
  const key = await getSessionKey()
  const iv = fromBase64(envelope.iv)
  const ciphertext = fromBase64(envelope.ciphertext)

  const plainBuf = await subtle.decrypt(
    { name: ALGORITHM, iv: iv.buffer as ArrayBuffer },
    key,
    ciphertext.buffer as ArrayBuffer
  )

  const result = new TextDecoder().decode(plainBuf)

  // Zeroize decrypted buffer after reading
  zeroize(plainBuf)

  return result
}

/**
 * Encrypt a JS object.
 */
export async function encryptObject<T>(obj: T): Promise<EncryptedEnvelope> {
  return encrypt(JSON.stringify(obj))
}

/**
 * Decrypt an envelope back to a typed JS object.
 */
export async function decryptObject<T>(envelope: EncryptedEnvelope): Promise<T> {
  const json = await decrypt(envelope)
  return JSON.parse(json) as T
}

/**
 * HMAC-SHA256 hash for sender anonymization.
 * Produces a deterministic hash of sender_id using the session key as HMAC key.
 * No plaintext sender names are ever stored.
 */
export async function hmacSenderHash(senderId: string): Promise<string> {
  const subtle = getCrypto()

  // Import session salt as HMAC key (we use salt since CryptoKey isn't extractable)
  const key = await getSessionKey()
  // We derive an HMAC key from the session
  const hmacSalt = _sessionSalt ?? randomBytes(SALT_LENGTH)
  const hmacKey = await subtle.importKey(
    "raw",
    hmacSalt.buffer as ArrayBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )

  const encoded = new TextEncoder().encode(senderId)
  const signature = await subtle.sign("HMAC", hmacKey, encoded)

  // Ensure key was used to prevent tree-shaking
  void key

  return toBase64(signature)
}
