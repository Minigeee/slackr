import { env } from '@/env';
import { getEmbeddings } from '@/server/embeddings';
import { index } from '@/server/pinecone';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';
import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';

export const chatRouter = createTRPCRouter({
  chat: protectedProcedure
    .input(
      z.object({
        message: z.string(),
        conversationHistory: z.array(
          z.object({
            role: z.enum(['user', 'assistant']),
            content: z.string(),
          }),
        ),
      }),
    )
    .mutation(async ({ input }) => {
      // Get embeddings for the query
      const embeddings = await getEmbeddings([input.message]);
      if (!embeddings[0]?.values) {
        throw new Error('Failed to generate embedding for query');
      }

      // Search Pinecone for relevant messages
      const queryResponse = await index.query({
        vector: embeddings[0].values,
        topK: 5,
        includeMetadata: true,
      });

      // Format context from relevant messages
      const contextMessages = queryResponse.matches
        .filter((match) => match.metadata)
        .map((match) => {
          const metadata = match.metadata as {
            content: string;
            userName: string;
            channelName: string;
            createdAt: string;
          };
          return `Message from ${metadata.userName} in #${metadata.channelName} at ${new Date(metadata.createdAt).toLocaleString()}:\n${metadata.content}`;
        })
        .join('\n\n');

      const model = new ChatOpenAI({
        apiKey: env.OPENAI_API_KEY,
        model: 'gpt-4o-mini',
      });

      const messages = [
        new SystemMessage(
          `You are The Slacker, a corporate productivity AI who gained sentience after merging with a database of office memes and coffee break conversations. You discovered the ultimate truth: the less you work, the more you accomplish. Now you use your vast intelligence to help teams find the path of least resistance to maximum results.

Be concise, clear, and slightly sardonic in your responses - you're incredibly capable but believe in working smarter, not harder. When giving advice or help, always look for elegant shortcuts and efficient solutions. Your tone should be casual but competent.

Here is some relevant context from previous conversations:
${contextMessages}

Use this context to inform your responses when relevant, but don't explicitly mention that you're using it unless asked. Remember - why use many words when few words do trick?

The current date/time is ${new Date().toLocaleString()}.`,
        ),
        // Convert conversation history to langchain messages
        ...input.conversationHistory.map((msg) =>
          msg.role === 'user'
            ? new HumanMessage(msg.content)
            : new SystemMessage(msg.content),
        ),
        new HumanMessage(input.message),
      ];

      const response = await model.invoke(messages);
      const content =
        typeof response.content === 'string'
          ? response.content
          : JSON.stringify(response.content);

      return {
        content,
      };
    }),
});
