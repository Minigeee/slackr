import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { pusher, getChannelName, EVENTS } from "@/server/pusher";
import { clerkClient } from "@clerk/nextjs/server";
import { User } from "@/types/user";

export const messageRouter = createTRPCRouter({
  getAll: protectedProcedure
    .input(z.object({
      channelId: z.string(),
      cursor: z.string().optional(),
      limit: z.number().min(1).max(100).default(50),
    }))
    .query(async ({ ctx, input }) => {
      // Verify user has access to channel
      const member = await ctx.db.channelMember.findUnique({
        where: {
          userId_channelId: {
            userId: ctx.auth.userId,
            channelId: input.channelId,
          },
        },
      });

      if (!member) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const messages = await ctx.db.message.findMany({
        where: { channelId: input.channelId },
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        orderBy: { createdAt: "desc" },
      });

      let nextCursor: string | undefined = undefined;
      if (messages.length > input.limit) {
        const nextItem = messages.pop();
        nextCursor = nextItem?.id;
      }

      return {
        messages,
        nextCursor,
      };
    }),

  getById: protectedProcedure
    .input(z.object({ messageId: z.string() }))
    .query(async ({ ctx, input }) => {
      const message = await ctx.db.message.findUnique({
        where: { id: input.messageId },
        include: { channel: true },
      });

      if (!message) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      // Verify user has access to channel
      const member = await ctx.db.channelMember.findUnique({
        where: {
          userId_channelId: {
            userId: ctx.auth.userId,
            channelId: message.channelId,
          },
        },
      });

      if (!member) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      return message;
    }),

  create: protectedProcedure
    .input(z.object({
      channelId: z.string(),
      content: z.string(),
      parentId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify user has access to channel
      const member = await ctx.db.channelMember.findUnique({
        where: {
          userId_channelId: {
            userId: ctx.auth.userId,
            channelId: input.channelId,
          },
        },
      });

      if (!member) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const client = await clerkClient();
      const sender = await client.users.getUser(ctx.auth.userId);
      const message = await ctx.db.message.create({
        data: {
          content: input.content,
          channelId: input.channelId,
          userId: ctx.auth.userId,
          parentId: input.parentId,
        },
      });

      // Trigger Pusher event for new message
      await pusher.trigger(
        getChannelName(input.channelId),
        EVENTS.NEW_MESSAGE,
        {
          ...message,
          user: {
            id: sender.id,
            firstName: sender.firstName,
            lastName: sender.lastName,
            imageUrl: sender.imageUrl,
            email: sender.emailAddresses[0]?.emailAddress,
            profilePicture: sender.imageUrl,
          } as User,
        }
      );

      return message;
    }),

  update: protectedProcedure
    .input(z.object({
      messageId: z.string(),
      content: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const message = await ctx.db.message.findUnique({
        where: { id: input.messageId },
      });

      if (!message) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      // Verify user is message author
      if (message.userId !== ctx.auth.userId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const updatedMessage = await ctx.db.message.update({
        where: { id: input.messageId },
        data: { content: input.content },
      });

      // Trigger Pusher event for updated message
      await pusher.trigger(
        getChannelName(message.channelId),
        EVENTS.UPDATE_MESSAGE,
        updatedMessage
      );

      return updatedMessage;
    }),

  delete: protectedProcedure
    .input(z.object({ messageId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const message = await ctx.db.message.findUnique({
        where: { id: input.messageId },
        include: { channel: { include: { workspace: { include: { members: true } } } } },
      });

      if (!message) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      // Allow message author or workspace admins to delete
      const isAdmin = message.channel.workspace.members.some(
        (member) =>
          member.userId === ctx.auth.userId &&
          ["admin", "owner"].includes(member.role)
      );

      if (message.userId !== ctx.auth.userId && !isAdmin) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      await ctx.db.message.delete({
        where: { id: input.messageId },
      });

      // Trigger Pusher event for deleted message
      await pusher.trigger(
        getChannelName(message.channelId),
        EVENTS.DELETE_MESSAGE,
        { messageId: input.messageId }
      );

      return true;
    }),
}); 