import {EmbeddingModel, FlagEmbedding} from 'fastembed'

let embedder: FlagEmbedding | null = null

/**
 * Get the embedding model (singleton)
 */
async function getEmbedder(): Promise<FlagEmbedding> {
  if (!embedder) {
    // Using all-MiniLM-L6-v2 for code/text embeddings
    // Same model as before, but via fastembed (no sharp dependency)
    embedder = await FlagEmbedding.init({model: EmbeddingModel.AllMiniLML6V2})
  }
  return embedder
}

/**
 * Generate embedding for a string
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const model = await getEmbedder()
  const embeddings = await model.embed([text])
  for await (const batch of embeddings) {
    // batch is an array of Float32Arrays, one per input text
    // Since we only pass one text, batch[0] is our embedding
    return Array.from(batch[0])
  }
  throw new Error('Failed to generate embedding')
}
