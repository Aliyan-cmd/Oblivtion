// ─── Encrypted IndexedDB Storage Layer ────────────────────────────────────────
// All data is stored encrypted. Sender names are HMAC-hashed.
// No plaintext content ever touches IndexedDB.

import type { ObligationType } from "./types"

// ─── EncryptedNode: the only schema that touches storage ─────────────────────

export interface EncryptedNode {
  id: string                // UUID v4
  ciphertext: string        // base64 AES-GCM encrypted original content
  iv: string                // base64 12-byte initialization vector
  noisy_embedding: number[] // 384-dim differentially private vector (serialized)
  ars_score: number         // Attention Resonance Score
  ttl_expiry: number        // Unix timestamp (ms)
  obligation_type: ObligationType | "GHOSTED"
  sender_hash: string       // HMAC-SHA256(sender_id, session_key)
  created_at: number        // Unix timestamp (ms)
}

const DB_NAME = "oblivion_vault"
const DB_VERSION = 1
const STORE_NAME = "encrypted_nodes"

let _db: IDBDatabase | null = null

/**
 * Open the IndexedDB database with encrypted node store.
 */
function openDB(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db)

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" })
        store.createIndex("by_type", "obligation_type", { unique: false })
        store.createIndex("by_ttl", "ttl_expiry", { unique: false })
        store.createIndex("by_ars", "ars_score", { unique: false })
        store.createIndex("by_sender", "sender_hash", { unique: false })
      }
    }

    request.onsuccess = () => {
      _db = request.result
      resolve(_db)
    }

    request.onerror = () => reject(request.error)
  })
}

/**
 * Store an encrypted node.
 */
export async function putNode(node: EncryptedNode): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite")
    const store = tx.objectStore(STORE_NAME)
    const request = store.put(node)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

/**
 * Get a single node by ID.
 */
export async function getNode(id: string): Promise<EncryptedNode | null> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly")
    const store = tx.objectStore(STORE_NAME)
    const request = store.get(id)
    request.onsuccess = () => resolve(request.result ?? null)
    request.onerror = () => reject(request.error)
  })
}

/**
 * Get all stored nodes.
 */
export async function getAllNodes(): Promise<EncryptedNode[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly")
    const store = tx.objectStore(STORE_NAME)
    const request = store.getAll()
    request.onsuccess = () => resolve(request.result ?? [])
    request.onerror = () => reject(request.error)
  })
}

/**
 * Delete a node by ID.
 */
export async function deleteNode(id: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite")
    const store = tx.objectStore(STORE_NAME)
    const request = store.delete(id)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

/**
 * Get all nodes with expired TTL.
 */
export async function getExpiredNodes(): Promise<EncryptedNode[]> {
  const db = await openDB()
  const now = Date.now()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly")
    const store = tx.objectStore(STORE_NAME)
    const index = store.index("by_ttl")
    const range = IDBKeyRange.upperBound(now)
    const request = index.getAll(range)
    request.onsuccess = () => {
      const nodes = (request.result ?? []) as EncryptedNode[]
      resolve(nodes.filter(n => n.ttl_expiry > 0 && n.ttl_expiry <= now))
    }
    request.onerror = () => reject(request.error)
  })
}

/**
 * Update the ARS score for a node.
 */
export async function updateNodeScore(id: string, newScore: number): Promise<void> {
  const node = await getNode(id)
  if (!node) return
  node.ars_score = newScore
  await putNode(node)
}

/**
 * Mark a node as ghosted.
 */
export async function ghostNode(id: string): Promise<void> {
  const node = await getNode(id)
  if (!node) return
  node.obligation_type = "GHOSTED"
  await putNode(node)
}

/**
 * Get count of all nodes.
 */
export async function getNodeCount(): Promise<number> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly")
    const store = tx.objectStore(STORE_NAME)
    const request = store.count()
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/**
 * Clear all data (nuclear option).
 */
export async function clearAllNodes(): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite")
    const store = tx.objectStore(STORE_NAME)
    const request = store.clear()
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}
