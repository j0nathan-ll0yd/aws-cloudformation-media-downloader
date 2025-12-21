import {pipeline} from '@xenova/transformers'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let embedder: any = null

/**
 * Get the embedding pipeline (singleton)
 */
async function getEmbedder() {
  if (!embedder) {
    // Using a lightweight but effective model for code/text embeddings
    // 'Xenova/all-MiniLM-L6-v2' is small (~80MB) and very fast
    embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2')
  }
  return embedder
}

/**
 * Generate embedding for a string
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const extractor = await getEmbedder()
  const output = await extractor(text, {pooling: 'mean', normalize: true})
  return Array.from(output.data)
}
