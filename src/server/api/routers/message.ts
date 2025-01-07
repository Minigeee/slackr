import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { observable } from "@trpc/server/observable";
import { EventEmitter } from "events";
import { Message } from "@prisma/client";

// Create an event emitter for message events
const ee = new EventEmitter();

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

      const message = await ctx.db.message.create({
        data: {
          content: input.content,
          channelId: input.channelId,
          userId: ctx.auth.userId,
          parentId: input.parentId,
        },
      });

      // Emit new message event
      ee.emit("newMessage", message);

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

      // Emit update message event
      ee.emit("updateMessage", updatedMessage);

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

      // Emit delete message event
      ee.emit("deleteMessage", { messageId: input.messageId });

      return true;
    }),

  onNew: protectedProcedure
    .input(z.object({ channelId: z.string() }))
    .subscription(async ({ ctx, input }) => {
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

      return observable<Message>((emit) => {
        const onNew = (message: Message) => {
          if (message.channelId === input.channelId) {
            emit.next(message);
          }
        };

        ee.on("newMessage", onNew);

        return () => {
          ee.off("newMessage", onNew);
        };
      });
    }),

  onUpdate: protectedProcedure
    .input(z.object({ channelId: z.string() }))
    .subscription(async ({ ctx, input }) => {
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

      return observable<Message>((emit) => {
        const onUpdate = (message: Message) => {
          if (message.channelId === input.channelId) {
            emit.next(message);
          }
        };

        ee.on("updateMessage", onUpdate);

        return () => {
          ee.off("updateMessage", onUpdate);
        };
      });
    }),

  onDelete: protectedProcedure
    .input(z.object({ channelId: z.string() }))
    .subscription(async ({ ctx, input }) => {
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

      return observable<{ messageId: string }>((emit) => {
        const onDelete = (data: { messageId: string }) => {
          emit.next(data);
        };

        ee.on("deleteMessage", onDelete);

        return () => {
          ee.off("deleteMessage", onDelete);
        };
      });
    }),
}); 