import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export const env = createEnv({
  /**
   * Specify your server-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars.
   */
  server: {
    DATABASE_URL: z
      .string()
      .url()
      .refine(
        (str) => !str.includes('YOUR_MYSQL_URL_HERE'),
        'You forgot to change the default URL',
      ),
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    // Add Clerk server-side variables
    CLERK_SECRET_KEY: z.string().min(1),
    // Add Pusher server-side variables
    PUSHER_APP_ID: z.string().min(1),
    PUSHER_KEY: z.string().min(1),
    PUSHER_SECRET: z.string().min(1),
    PUSHER_CLUSTER: z.string().min(1),
    // Add AWS server-side variables
    AWS_REGION: z.string().min(1),
    AWS_ACCESS_KEY_ID: z.string().min(1),
    AWS_SECRET_ACCESS_KEY: z.string().min(1),
    AWS_BUCKET_NAME: z.string().min(1),
    // Add Pinecone server-side variables
    PINECONE_INDEX: z.string().min(1),
    PINECONE_API_KEY: z.string().min(1),
    PINECONE_EMBEDDING_MODEL: z.string().min(1),
    // Add OpenAI server-side variables
    OPENAI_API_KEY: z.string().min(1),
    // LangSmith
    LANGCHAIN_API_KEY: z.string(),
    LANGCHAIN_PROJECT: z.string(),
    LANGCHAIN_ENDPOINT: z.string().url(),
    LANGCHAIN_TRACING: z.enum(['true', 'false']).default('true'),
  },

  /**
   * Specify your client-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars. To expose them to the client, prefix them with
   * `NEXT_PUBLIC_`.
   */
  client: {
    // Add Clerk client-side variables
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
    // Add Pusher client-side variables
    NEXT_PUBLIC_PUSHER_KEY: z.string().min(1),
    NEXT_PUBLIC_PUSHER_CLUSTER: z.string().min(1),
  },

  /**
   * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
   * middlewares) or client-side so we need to destruct manually.
   */
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
    // Clerk
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
    // Pusher
    PUSHER_APP_ID: process.env.PUSHER_APP_ID,
    PUSHER_KEY: process.env.PUSHER_KEY,
    PUSHER_SECRET: process.env.PUSHER_SECRET,
    PUSHER_CLUSTER: process.env.PUSHER_CLUSTER,
    NEXT_PUBLIC_PUSHER_KEY: process.env.NEXT_PUBLIC_PUSHER_KEY,
    NEXT_PUBLIC_PUSHER_CLUSTER: process.env.NEXT_PUBLIC_PUSHER_CLUSTER,
    // AWS
    AWS_REGION: process.env.AWS_REGION,
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
    AWS_BUCKET_NAME: process.env.AWS_BUCKET_NAME,
    // Pinecone
    PINECONE_INDEX: process.env.PINECONE_INDEX,
    PINECONE_API_KEY: process.env.PINECONE_API_KEY,
    PINECONE_EMBEDDING_MODEL: process.env.PINECONE_EMBEDDING_MODEL,
    // OpenAI
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    // LangSmith
    LANGCHAIN_API_KEY: process.env.LANGCHAIN_API_KEY,
    LANGCHAIN_PROJECT: process.env.LANGCHAIN_PROJECT,
    LANGCHAIN_ENDPOINT: process.env.LANGCHAIN_ENDPOINT,
    LANGCHAIN_TRACING: process.env.LANGCHAIN_TRACING,
  },
  /**
   * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
   * useful for Docker builds.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  /**
   * Makes it so that empty strings are treated as undefined. `SOME_VAR: z.string()` and
   * `SOME_VAR=''` will throw an error.
   */
  emptyStringAsUndefined: true,
});
