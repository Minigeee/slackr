import { env } from '@/env';
import { Pinecone } from '@pinecone-database/pinecone';

const pc = new Pinecone({
  apiKey: env.PINECONE_API_KEY,
});

export const index = pc.index(env.PINECONE_INDEX);

export default pc;
