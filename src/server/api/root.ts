import { createTRPCRouter } from "./trpc";
import { workspaceRouter } from "./routers/workspace";
import { channelRouter } from "./routers/channel";
import { messageRouter } from "./routers/message";
import { type inferRouterInputs, type inferRouterOutputs } from "@trpc/server";

export const appRouter = createTRPCRouter({
  workspace: workspaceRouter,
  channel: channelRouter,
  message: messageRouter,
});

// Export caller creator
export const createCaller = appRouter.createCaller;

export type AppRouter = typeof appRouter;
export type RouterInputs = inferRouterInputs<AppRouter>;
export type RouterOutputs = inferRouterOutputs<AppRouter>;
