import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { Channel } from "@prisma/client";

export const channelRouter = createTRPCRouter({
  getAll: protectedProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ ctx, input }) => {
      // First verify user is a member of the workspace
      const workspaceMember = await ctx.db.workspaceMember.findUnique({
        where: {
          userId_workspaceId: {
            userId: ctx.auth.userId,
            workspaceId: input.workspaceId,
          },
        },
      });

      if (!workspaceMember) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      return ctx.db.channel.findMany({
        where: { workspaceId: input.workspaceId },
      });
    }),

  getById: protectedProcedure
    .input(z.object({ channelId: z.string() }))
    .query(async ({ ctx, input }) => {
      const channel = await ctx.db.channel.findUnique({
        where: { id: input.channelId },
        include: {
          messages: {
            orderBy: { createdAt: "desc" },
            take: 50,
          },
        },
      });

      if (!channel) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

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

      return channel;
    }),

  getMembers: protectedProcedure
    .input(z.object({ channelId: z.string() }))
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

      return ctx.db.channelMember.findMany({
        where: { channelId: input.channelId },
      });
    }),

  create: protectedProcedure
    .input(z.object({
      workspaceId: z.string(),
      name: z.string(),
      description: z.string().optional(),
      isPrivate: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify user is workspace member
      const workspaceMember = await ctx.db.workspaceMember.findUnique({
        where: {
          userId_workspaceId: {
            userId: ctx.auth.userId,
            workspaceId: input.workspaceId,
          },
        },
      });

      if (!workspaceMember) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      return ctx.db.channel.create({
        data: {
          name: input.name,
          description: input.description,
          isPrivate: input.isPrivate,
          workspaceId: input.workspaceId,
          members: {
            create: {
              userId: ctx.auth.userId,
            },
          },
        },
      });
    }),

  update: protectedProcedure
    .input(z.object({
      channelId: z.string(),
      name: z.string().optional(),
      description: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const channel = await ctx.db.channel.findUnique({
        where: { id: input.channelId },
        include: { workspace: { include: { members: true } } },
      });

      if (!channel) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      // Verify user is workspace admin/owner
      const isAdmin = channel.workspace.members.some(
        (member) => 
          member.userId === ctx.auth.userId && 
          ["admin", "owner"].includes(member.role)
      );

      if (!isAdmin) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      return ctx.db.channel.update({
        where: { id: input.channelId },
        data: {
          name: input.name,
          description: input.description,
        },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ channelId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const channel = await ctx.db.channel.findUnique({
        where: { id: input.channelId },
        include: { workspace: { include: { members: true } } },
      });

      if (!channel) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      // Verify user is workspace admin/owner
      const isAdmin = channel.workspace.members.some(
        (member) => 
          member.userId === ctx.auth.userId && 
          ["admin", "owner"].includes(member.role)
      );

      if (!isAdmin) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      await ctx.db.channel.delete({
        where: { id: input.channelId },
      });

      return true;
    }),

  join: protectedProcedure
    .input(z.object({ channelId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const channel = await ctx.db.channel.findUnique({
        where: { id: input.channelId },
        include: { workspace: { include: { members: true } } },
      });

      if (!channel) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      // Verify user is workspace member
      const isMember = channel.workspace.members.some(
        (member) => member.userId === ctx.auth.userId
      );

      if (!isMember) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      return ctx.db.channelMember.create({
        data: {
          userId: ctx.auth.userId,
          channelId: input.channelId,
        },
      });
    }),

  leave: protectedProcedure
    .input(z.object({ channelId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.channelMember.delete({
        where: {
          userId_channelId: {
            userId: ctx.auth.userId,
            channelId: input.channelId,
          },
        },
      });

      return true;
    }),

  addMember: protectedProcedure
    .input(z.object({
      channelId: z.string(),
      userId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const channel = await ctx.db.channel.findUnique({
        where: { id: input.channelId },
        include: { workspace: { include: { members: true } } },
      });

      if (!channel) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      // Verify user is workspace admin/owner
      const isAdmin = channel.workspace.members.some(
        (member) => 
          member.userId === ctx.auth.userId && 
          ["admin", "owner"].includes(member.role)
      );

      if (!isAdmin) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      return ctx.db.channelMember.create({
        data: {
          userId: input.userId,
          channelId: input.channelId,
        },
      });
    }),

  removeMember: protectedProcedure
    .input(z.object({
      channelId: z.string(),
      userId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const channel = await ctx.db.channel.findUnique({
        where: { id: input.channelId },
        include: { workspace: { include: { members: true } } },
      });

      if (!channel) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      // Verify user is workspace admin/owner
      const isAdmin = channel.workspace.members.some(
        (member) => 
          member.userId === ctx.auth.userId && 
          ["admin", "owner"].includes(member.role)
      );

      if (!isAdmin) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      await ctx.db.channelMember.delete({
        where: {
          userId_channelId: {
            userId: input.userId,
            channelId: input.channelId,
          },
        },
      });

      return true;
    }),

  getAllWithMembership: protectedProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ ctx, input }) => {
      // First verify user is a member of the workspace
      const workspaceMember = await ctx.db.workspaceMember.findUnique({
        where: {
          userId_workspaceId: {
            userId: ctx.auth.userId,
            workspaceId: input.workspaceId,
          },
        },
      });

      if (!workspaceMember) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      // Get all channels in the workspace
      const channels = await ctx.db.channel.findMany({
        where: { workspaceId: input.workspaceId },
        include: {
          members: {
            where: { userId: ctx.auth.userId },
            select: { userId: true },
          },
        },
      });

      // Split into joined and unjoined
      const [joined, unjoined] = channels.reduce<[Channel[], Channel[]]>(
        ([j, u], channel) => {
          const isJoined = channel.members.length > 0;
          const channelWithoutMembers = {
            ...channel,
            members: undefined,
          };
          return isJoined
            ? [[...j, channelWithoutMembers], u]
            : [j, [...u, channelWithoutMembers]];
        },
        [[], []]
      );

      return { joined, unjoined };
    }),
}); 