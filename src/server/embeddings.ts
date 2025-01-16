import pc from './pinecone';

export async function getEmbeddings(texts: string[]) {
  const embeddings = await pc.inference.embed(
    process.env.PINECONE_EMBEDDING_MODEL!,
    texts,
    { inputType: 'passage', truncate: 'END' },
  );

  return embeddings;
}
