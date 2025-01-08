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
        include: {
          attachments: true,
          reactions: true,
        },
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
        include: { 
          channel: true,
          attachments: true,
          reactions: true,
        },
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
      threadId: z.string().optional(),
      attachments: z.array(z.object({
        key: z.string(),
        filename: z.string(),
        mimeType: z.string(),
        size: z.number(),
        width: z.number().optional(),
        height: z.number().optional(),
      })),
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

      // Create message and attachments in a transaction
      const message = await ctx.db.message.create({
        data: {
          content: input.content,
          channelId: input.channelId,
          userId: ctx.auth.userId,
          parentId: input.parentId,
          threadId: input.threadId,
          attachments: {
            create: input.attachments.map(attachment => ({
              ...attachment,
              url: `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${attachment.key}`,
            })),
          },
        },
        include: {
          attachments: true,
        },
      });

      const client = await clerkClient();
      const sender = await client.users.getUser(ctx.auth.userId);

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
        include: {
          attachments: true,
        },
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
        include: { 
          channel: { include: { workspace: { include: { members: true } } } },
          attachments: true,
        },
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

      // Delete attachments from S3
      await Promise.all(
        message.attachments.map(async (attachment) => {
          try {
            await ctx.db.attachment.delete({
              where: { id: attachment.id },
            });
          } catch (error) {
            console.error(`Failed to delete attachment ${attachment.id}:`, error);
          }
        })
      );

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

  toggleReaction: protectedProcedure
    .input(z.object({
      messageId: z.string(),
      emoji: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
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

      // Check if reaction already exists
      const existingReaction = await ctx.db.messageReaction.findUnique({
        where: {
          userId_messageId_emoji: {
            userId: ctx.auth.userId,
            messageId: input.messageId,
            emoji: input.emoji,
          },
        },
      });

      if (existingReaction) {
        // Remove reaction
        await ctx.db.messageReaction.delete({
          where: { id: existingReaction.id },
        });

        // Trigger Pusher event for removed reaction
        await pusher.trigger(
          getChannelName(message.channelId),
          EVENTS.REMOVE_REACTION,
          {
            messageId: input.messageId,
            emoji: input.emoji,
            userId: ctx.auth.userId,
          }
        );

        return { added: false };
      } else {
        // Add reaction
        const reaction = await ctx.db.messageReaction.create({
          data: {
            emoji: input.emoji,
            userId: ctx.auth.userId,
            messageId: input.messageId,
          },
        });

        const client = await clerkClient();
        const user = await client.users.getUser(ctx.auth.userId);

        // Trigger Pusher event for new reaction
        await pusher.trigger(
          getChannelName(message.channelId),
          EVENTS.ADD_REACTION,
          {
            messageId: input.messageId,
            emoji: input.emoji,
            userId: ctx.auth.userId,
            user: {
              id: user.id,
              firstName: user.firstName,
              lastName: user.lastName,
              imageUrl: user.imageUrl,
              email: user.emailAddresses[0]?.emailAddress,
              profilePicture: user.imageUrl,
            } as User,
          }
        );

        return { added: true };
      }
    }),
}); 