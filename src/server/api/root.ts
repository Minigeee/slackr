import { createTRPCRouter } from '@/server/api/trpc';
import { attachmentRouter } from './routers/attachment';
import { channelRouter } from './routers/channel';
import { messageRouter } from './routers/message';
import { searchRouter } from './routers/search';
import { workspaceRouter } from './routers/workspace';
import { chatRouter } from './routers/chat';

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  message: messageRouter,
  workspace: workspaceRouter,
  channel: channelRouter,
  attachment: attachmentRouter,
  search: searchRouter,
  chat: chatRouter,
});

// Export caller creator
export const createCaller = appRouter.createCaller;

// export type definition of API
export type AppRouter = typeof appRouter;
