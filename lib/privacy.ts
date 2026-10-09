// ─── Differential Privacy Layer ───────────────────────────────────────────────
// Adds calibrated Laplace noise to embedding vectors before persistence.
// Original vectors are zeroized immediately after noising.
// This ensures that even if IndexedDB is compromised, exact content
// cannot be reconstructed from stored embeddings.

import { zeroize } from "./crypto"

const EMBEDDING_DIM = 384  // Standard sentence-transformer dimension
const EPSILON = 1.0        // Privacy budget (ε=1.0 provides strong privacy)
const SENSITIVITY = 1.0    // L1 sensitivity of the query function

/**
 * Generate a single Laplace random variable.
 * Uses the inverse CDF method: X = -b * sign(U-0.5) * ln(1 - 2|U-0.5|)
 * where b = sensitivity / epsilon
 */
function laplaceSample(b: number): number {
  const u = Math.random() - 0.5
  const sign = u >= 0 ? 1 : -1
  const absU = Math.abs(u)
  // Clamp to avoid ln(0)
  const clamped = Math.max(1e-15, 1 - 2 * absU)
  return -b * sign * Math.log(clamped)
}

/**
 * Normalize a vector to the unit sphere.
 * Preserves cosine similarity for semantic search while
 * obfuscating the exact magnitude of each dimension.
 */
function normalizeToUnitSphere(vec: Float32Array): Float32Array {
  let norm = 0
  for (let i = 0; i < vec.length; i++) {
    norm += vec[i] * vec[i]
  }
  norm = Math.sqrt(norm)

  if (norm < 1e-10) return vec // Avoid division by zero

  const result = new Float32Array(vec.length)
  for (let i = 0; i < vec.length; i++) {
    result[i] = vec[i] / norm
  }
  return result
}

/**
 * Generate a simple content embedding from text.
 * This is a deterministic hash-based embedding (no ML model required).
 * Uses character-level n-gram hashing to fill the 384-dim vector.
 */
export function generateEmbedding(text: string): Float32Array {
  const vec = new Float32Array(EMBEDDING_DIM)
  const normalized = text.toLowerCase().trim()

  // Character trigram hashing into embedding dimensions
  for (let i = 0; i < normalized.length - 2; i++) {
    const trigram = normalized.charCodeAt(i) * 31 * 31 +
                    normalized.charCodeAt(i + 1) * 31 +
                    normalized.charCodeAt(i + 2)
    const dim = Math.abs(trigram) % EMBEDDING_DIM
    vec[dim] += 1
  }

  // Also hash whole words for semantic signal
  const words = normalized.split(/\s+/)
  for (const word of words) {
    let hash = 0
    for (let i = 0; i < word.length; i++) {
      hash = ((hash << 5) - hash + word.charCodeAt(i)) | 0
    }
    const dim = Math.abs(hash) % EMBEDDING_DIM
    vec[dim] += 2 // Words get double weight
  }

  return normalizeToUnitSphere(vec)
}

/**
 * Apply differential privacy to an embedding vector.
 *
 * Process:
 * 1. Generate Laplace noise for each of 384 dimensions
 * 2. Add noise to the original embedding
 * 3. Normalize to unit sphere (preserves cosine similarity for search)
 * 4. Zeroize the original embedding immediately
 *
 * @param embedding - The original 384-dim embedding vector
 * @param epsilon - Privacy budget (default: 1.0, lower = more private)
 * @returns The differentially private embedding (unit-normalized)
 */
export function addDifferentialPrivacy(
  embedding: Float32Array,
  epsilon: number = EPSILON
): Float32Array {
  const b = SENSITIVITY / epsilon
  const noisy = new Float32Array(embedding.length)

  for (let i = 0; i < embedding.length; i++) {
    noisy[i] = embedding[i] + laplaceSample(b)
  }

  // Zeroize the original embedding — only the noisy version persists
  zeroize(new Uint8Array(embedding.buffer))

  return normalizeToUnitSphere(noisy)
}

/**
 * Compute cosine similarity between two unit-normalized vectors.
 * Since vectors are unit-normalized, cosine = dot product.
 */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0
  const len = Math.min(a.length, b.length)
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i]
  }
  return dot
}
