import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { clerkClient, type User as ClerkUser } from '@clerk/nextjs/server';
import { User } from '@/types/user';

export const searchRouter = createTRPCRouter({
  messages: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        query: z.string().min(1),
        limit: z.number().min(1).max(50).default(20),
        cursor: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      // First, get all channels the user has access to in this workspace
      const userChannels = await ctx.db.channelMember.findMany({
        where: {
          userId: ctx.auth.userId,
          channel: {
            workspaceId: input.workspaceId,
          },
        },
        select: {
          channelId: true,
        },
      });

      const channelIds = userChannels.map((c) => c.channelId);

      if (channelIds.length === 0) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: "You don't have access to any channels in this workspace",
        });
      }

      // Search messages using PostgreSQL full-text search
      const messages = await ctx.db.$queryRaw<Array<any>>`
        WITH ranked_messages AS (
          SELECT m.*,
                 ts_rank(to_tsvector('english', m.content), plainto_tsquery('english', ${input.query})) as rank
          FROM "Message" m
          WHERE m."channelId" = ANY(${channelIds})
            AND to_tsvector('english', m.content) @@ plainto_tsquery('english', ${input.query})
        )
        SELECT * FROM ranked_messages
        WHERE (${input.cursor}::text IS NULL OR 
              id < ${input.cursor})
        ORDER BY rank DESC, "createdAt" DESC
        LIMIT ${input.limit + 1}
      `;

      // Get user info for messages
      const client = await clerkClient();
      const userIds = [...new Set(messages.map((m) => m.userId))];
      const users = await client.users.getUserList({ userId: userIds });
      const usersMap = new Map(
        users.data.map((user: ClerkUser) => [
          user.id,
          {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            imageUrl: user.imageUrl,
            email: user.emailAddresses[0]?.emailAddress,
            profilePicture: user.imageUrl,
          } as User,
        ]),
      );

      // Format messages and determine next cursor
      let nextCursor: string | undefined = undefined;
      if (messages.length > input.limit) {
        const nextItem = messages.pop();
        nextCursor = nextItem?.id;
      }

      const formattedMessages = messages.map((message) => ({
        ...message,
        user: usersMap.get(message.userId),
        rank: Number(message.rank),
      }));

      return {
        items: formattedMessages,
        nextCursor,
      };
    }),
});
