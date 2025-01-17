import { getEmbeddings } from '@/server/embeddings';
import { index } from '@/server/pinecone';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';

function mean(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  return numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
}

export const watchRouter = createTRPCRouter({
  getAll: protectedProcedure.query(async ({ ctx }) => {
    const watchPrompts = await ctx.db.watchPrompt.findMany({
      where: { userId: ctx.auth.userId },
      orderBy: { createdAt: 'desc' },
    });

    // For each watch prompt, find matching messages
    const promptsWithMatches = await Promise.all(
      watchPrompts.map(async (prompt) => {
        if (!prompt.isActive) {
          return { ...prompt, matches: [] };
        }

        // Get messages from the lookback period
        const lookbackDate = Math.round(
          (new Date().getTime() - prompt.lookbackHours * 60 * 60 * 1000) / 1000,
        );

        // First pass: Use vector similarity search with Pinecone
        const vectorMatches = await index.query({
          vector: prompt.embedding,
          topK: 50, // Get top 50 candidates for further filtering
          filter: {
            createdAt: { $gte: lookbackDate },
          },
        });

        // Filter by score
        const scores = vectorMatches.matches.map((match) => match.score ?? 0);
        const adjustment = Math.min(prompt.minRelevanceScore - mean(scores), 0);
        const normalizedScores = scores.map(
          (s) => (s + adjustment - prompt.minRelevanceScore) / 0.05,
        );
        const filteredMatches = vectorMatches.matches.filter(
          (match, i) =>
            normalizedScores[i] !== undefined && normalizedScores[i] > 0,
        );

        const scoreMap = new Map<string, number>();
        filteredMatches.forEach((match, i) => {
          const score = normalizedScores[i];
          if (score) scoreMap.set(match.id, score);
        });

        // Get the actual messages from the database
        const messageIds = filteredMatches.map((match) => match.id);
        const messages = await ctx.db.message.findMany({
          where: {
            id: { in: messageIds },
          },
          include: {
            channel: true,
          },
        });

        const messagesWithScores = messages
          .map((message) => ({
            id: message.id,
            content: message.content,
            channelName: message.channel.name,
            createdAt: message.createdAt,
            score: scoreMap.get(message.id) ?? 0,
          }))
          .sort((a, b) => b.score - a.score);

        // console.log(messagesWithScores);

        return {
          ...prompt,
          matches: messagesWithScores,
        };
      }),
    );

    return promptsWithMatches;
  }),

  create: protectedProcedure
    .input(
      z.object({
        prompt: z.string().min(1),
        lookbackHours: z.number().min(1).max(168).default(24),
        minRelevanceScore: z.number().min(0).max(1).default(0.7),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Get embedding for the prompt
      const embedding = await getEmbeddings([input.prompt]);

      return ctx.db.watchPrompt.create({
        data: {
          userId: ctx.auth.userId,
          prompt: input.prompt,
          embedding: embedding[0]?.values,
          lookbackHours: input.lookbackHours,
          minRelevanceScore: input.minRelevanceScore,
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        prompt: z.string().min(1).optional(),
        lookbackHours: z.number().min(1).max(168).optional(),
        minRelevanceScore: z.number().min(0).max(1).optional(),
        isActive: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const watchPrompt = await ctx.db.watchPrompt.findUnique({
        where: { id: input.id },
      });

      if (!watchPrompt || watchPrompt.userId !== ctx.auth.userId) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }

      // If prompt is being updated, get new embedding
      const embedding = input.prompt
        ? await getEmbeddings([input.prompt])
        : undefined;

      return ctx.db.watchPrompt.update({
        where: { id: input.id },
        data: {
          prompt: input.prompt,
          embedding: embedding?.[0]?.values,
          lookbackHours: input.lookbackHours,
          minRelevanceScore: input.minRelevanceScore,
          isActive: input.isActive,
        },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const watchPrompt = await ctx.db.watchPrompt.findUnique({
        where: { id: input.id },
      });

      if (!watchPrompt || watchPrompt.userId !== ctx.auth.userId) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }

      await ctx.db.watchPrompt.delete({
        where: { id: input.id },
      });

      return true;
    }),
});
