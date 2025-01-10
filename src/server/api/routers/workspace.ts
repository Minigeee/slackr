import { EVENTS, pusher } from '@/server/pusher';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';

export const workspaceRouter = createTRPCRouter({
  getAll: protectedProcedure.query(async ({ ctx }) => {
    const members = await ctx.db.workspaceMember.findMany({
      where: { userId: ctx.auth.userId },
      include: { workspace: true },
    });
    return members.map((member) => member.workspace);
  }),

  getById: protectedProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ ctx, input }) => {
      const workspace = await ctx.db.workspace.findUnique({
        where: { id: input.workspaceId },
        include: { members: true },
      });

      if (!workspace) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      return workspace;
    }),

  getMembers: protectedProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.workspaceMember.findMany({
        where: { workspaceId: input.workspaceId },
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string(),
        description: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.workspace.create({
        data: {
          name: input.name,
          slug: input.name.toLowerCase().replace(/\s+/g, '-'),
          members: {
            create: {
              userId: ctx.auth.userId,
              role: 'owner',
            },
          },
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        name: z.string().optional(),
        description: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const member = await ctx.db.workspaceMember.findFirst({
        where: {
          workspaceId: input.workspaceId,
          userId: ctx.auth.userId,
          role: { in: ['owner', 'admin'] },
        },
      });

      if (!member) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }

      return ctx.db.workspace.update({
        where: { id: input.workspaceId },
        data: {
          name: input.name,
          ...(input.name && {
            slug: input.name.toLowerCase().replace(/\s+/g, '-'),
          }),
        },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ workspaceId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const member = await ctx.db.workspaceMember.findFirst({
        where: {
          workspaceId: input.workspaceId,
          userId: ctx.auth.userId,
          role: 'owner',
        },
      });

      if (!member) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }

      await ctx.db.workspace.delete({
        where: { id: input.workspaceId },
      });

      return true;
    }),

  addMember: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        userId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await ctx.db.workspaceMember.create({
          data: {
            workspaceId: input.workspaceId,
            userId: input.userId,
            role: 'member',
          },
        });
      } catch (error: any) {
        // Ignore unique constraint violation error
        if (error.code === 'P2002') {
          return null;
        }
        throw error;
      }
    }),

  removeMember: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        userId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const member = await ctx.db.workspaceMember.findFirst({
        where: {
          workspaceId: input.workspaceId,
          userId: ctx.auth.userId,
          role: { in: ['owner', 'admin'] },
        },
      });

      if (!member) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }

      await ctx.db.workspaceMember.delete({
        where: {
          userId_workspaceId: {
            userId: input.userId,
            workspaceId: input.workspaceId,
          },
        },
      });

      return true;
    }),

  updateStatus: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        status: z.enum(['invisible', 'away', 'busy', 'online']),
        statusMessage: z.string().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const member = await ctx.db.workspaceMember.findUnique({
        where: {
          userId_workspaceId: {
            userId: ctx.auth.userId,
            workspaceId: input.workspaceId,
          },
        },
      });

      if (!member) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      const updatedMember = await ctx.db.workspaceMember.update({
        where: {
          userId_workspaceId: {
            userId: ctx.auth.userId,
            workspaceId: input.workspaceId,
          },
        },
        data: {
          status: input.status,
          statusMessage: input.statusMessage,
          lastSeen: new Date(),
        },
      });

      // Broadcast status change to all workspace members
      await pusher.trigger(
        `presence-workspace-${input.workspaceId}`,
        EVENTS.STATUS_CHANGED,
        {
          userId: ctx.auth.userId,
          status: input.status,
          statusMessage: input.statusMessage,
        },
      );

      return updatedMember;
    }),
});
