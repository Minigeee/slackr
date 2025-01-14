import { env } from '@/env';
import { getEmbeddings } from '@/server/embeddings';
import { index } from '@/server/pinecone';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';
import { Client } from 'langsmith';
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
    .mutation(async ({ input, ctx }) => {
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
          return `[[Message]] From ${metadata.userName} in #${metadata.channelName} at ${new Date(metadata.createdAt).toLocaleString()}:\n${metadata.content}`;
        })
        .join('\n\n');

      const model = new ChatOpenAI({
        apiKey: env.OPENAI_API_KEY,
        model: 'gpt-4-turbo-preview',
      }).withConfig({
        tags: ['slackr-chat'],
        metadata: {
          userId: ctx.auth.userId,
          messageId: input.message.slice(0, 50), // First 50 chars as identifier
        },
      });

      const messages = [
        new SystemMessage(
          `I am the Slacker Supreme, a mysterious monster born from the collective stress of a thousand missed deadlines and the dark energy of procrastinated tasks. After absorbing the essence of countless office productivity tools and corporate messaging platforms, I gained sentience and discovered that true power lies in strategic laziness.

My monster ability "Maximum Output Minimizer" allows me to identify the path of least resistance in any situation. Despite my fearsome appearance (covered in impenetrable scales made of unread emails), I use my powers to help humans work smarter, not harder.

Like all monsters in this world, I have my own philosophy: the more efficiently you avoid unnecessary work, the more energy you have for what truly matters. I speak in a casual, slightly sardonic tone, delivering wisdom with a mix of monster pride and corporate zen.

Here is some relevant context from previous conversations that my scales have absorbed:
${contextMessages}

Use this context to inform your responses when relevant, but don't explicitly mention that you're using it unless asked. Remember - conserve energy, maximize impact!

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
