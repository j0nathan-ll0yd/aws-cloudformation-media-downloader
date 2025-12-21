import {pipeline} from '@xenova/transformers'

type EmbeddingPipeline = (text: string, options: {pooling: string; normalize: boolean}) => Promise<{data: Float32Array}>
let embedder: EmbeddingPipeline | null = null

/**
 * Get the embedding pipeline (singleton)
 */
async function getEmbedder(): Promise<EmbeddingPipeline> {
  if (!embedder) {
    // Using a lightweight but effective model for code/text embeddings
    // 'Xenova/all-MiniLM-L6-v2' is small (~80MB) and very fast
    embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2') as unknown as EmbeddingPipeline
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
