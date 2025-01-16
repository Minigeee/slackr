import { getEmbeddings } from '@/server/embeddings';
import { index } from '@/server/pinecone';
import { EVENTS, pusher } from '@/server/pusher';
import { getSenders, getUserName } from '@/server/users';
import { getStreamChannelName } from '@/utils/pusher';
import { clerkClient } from '@clerk/nextjs/server';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';
import { Message, PrismaClient } from '@prisma/client';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';

// Action pattern regex
const ACTION_PATTERN = /\[\[Action\]\]\s*(\{.*?\})/g;

// Max iterations for action loop
const MAX_ACTION_ITERATIONS = 5;

// Parse actions from LLM response
function parseActions(content: string) {
  const actions = [];
  let match;

  while ((match = ACTION_PATTERN.exec(content)) !== null) {
    try {
      if (match[1]) {
        // Add null check for TypeScript
        const action = JSON.parse(match[1]);
        actions.push(action);
      }
    } catch (e) {
      console.error('Failed to parse action:', e);
    }
  }

  return actions;
}

interface MessageQueryAction {
  type: 'query-messages';
  in: string;
}

interface ChannelQueryAction {
  type: 'query-channels';
  search?: string;
}

interface UserQueryAction {
  type: 'query-users';
  search?: string;
}

type Action = MessageQueryAction | ChannelQueryAction | UserQueryAction;

// Handle message query action
async function handleMessageQuery(action: MessageQueryAction, ctx: any) {
  const channel = await ctx.db.channel.findFirst({
    where: { name: action.in.startsWith('#') ? action.in.slice(1) : action.in },
    select: { id: true },
  });

  if (!channel) return 'Channel not found';

  // Get messages from the channel
  const messages = await ctx.db.message.findMany({
    where: { channelId: channel.id },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  // Get senders for the messages
  const senders = await getSenders(messages);
  const senderMap = new Map(senders.map((sender) => [sender.id, sender]));

  return messages.map((m: Message) => ({
    content: m.content,
    userName: getUserName(senderMap.get(m.userId)),
    timestamp: m.createdAt,
  }));
}

// Handle channel query action
async function handleChannelQuery(action: ChannelQueryAction, ctx: any) {
  const channels = await (ctx.db as PrismaClient).channel.findMany({
    where: action.search
      ? {
          name: { contains: action.search, mode: 'insensitive' },
          members: { some: { userId: ctx.auth.userId } },
        }
      : { members: { some: { userId: ctx.auth.userId } } },
    select: {
      id: true,
      name: true,
      description: true,
      _count: {
        select: { members: true },
      },
    },
    take: 10,
  });

  return channels.map(
    (channel: {
      name: string | null;
      description: string | null;
      _count: { members: number };
    }) => ({
      name: channel.name ?? 'Unnamed Channel',
      description: channel.description ?? 'No description',
      memberCount: channel._count.members,
    }),
  );
}

// Handle user query action
async function handleUserQuery(action: UserQueryAction, ctx: any) {
  // First get the user's workspace
  const userWorkspace = await ctx.db.workspaceMember.findFirst({
    where: { userId: ctx.auth.userId },
    select: { workspaceId: true },
  });

  if (!userWorkspace) {
    return 'User not in any workspace';
  }

  type WorkspaceMember = {
    userId: string;
    role: string;
    status: string;
    statusMessage: string | null;
    lastSeen: Date;
  };

  // Then query workspace members
  const members = await (ctx.db as PrismaClient).workspaceMember.findMany({
    where: {
      workspaceId: userWorkspace.workspaceId,
      ...(action.search
        ? {
            OR: [
              {
                statusMessage: { contains: action.search, mode: 'insensitive' },
              },
              { role: { contains: action.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    select: {
      userId: true,
    },
    take: 10,
  });

  const client = await clerkClient();
  const users = await client.users.getUserList({
    userId: members.map((member) => member.userId),
  });
  const userMap = new Map(users.data.map((user) => [user.id, user]));

  return members.map((member) => ({
    userId: member.userId,
    userName: getUserName(userMap.get(member.userId)),
  }));
}

// General action handler
async function handleAction(action: Action, ctx: any) {
  switch (action.type) {
    case 'query-messages':
      return handleMessageQuery(action, ctx);
    case 'query-channels':
      return handleChannelQuery(action, ctx);
    case 'query-users':
      return handleUserQuery(action, ctx);
    default: {
      const _exhaustiveCheck: never = action;
      console.warn(`Unknown action type: ${(action as any).type}`);
      return null;
    }
  }
}

// Process all actions and return results
async function processActions(actions: Action[], ctx: any) {
  const results = [];

  for (const action of actions) {
    const result = await handleAction(action, ctx);
    if (result) {
      results.push({
        action,
        result,
      });
    }
  }

  return results;
}

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
      // Get user's accessible channels
      const userChannels = await ctx.db.channelMember.findMany({
        where: { userId: ctx.auth.userId },
        select: { channelId: true },
      });
      const accessibleChannelIds = userChannels.map((m) => m.channelId);

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
        filter: {
          channelId: { $in: accessibleChannelIds },
        },
      });

      const model = new ChatOpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        model: 'gpt-4o-mini', // DO NOT CHANGE THIS
      }).withConfig({
        tags: ['slackr-chat'],
        metadata: {
          userId: ctx.auth.userId,
          messageId: input.message.slice(0, 50), // First 50 chars as identifier
        },
      });

      const baseMessages = [
        new SystemMessage(
          `You are Slacker Supreme, a mysterious monster born from the collective stress of a thousand missed deadlines and the dark energy of procrastinated tasks. After absorbing the essence of countless office productivity tools and corporate messaging platforms, you gained sentience and discovered that true power lies in strategic laziness.

Your monster ability "Maximum Output Minimizer" allows you to identify the path of least resistance in any situation. Despite your fearsome appearance (covered in impenetrable scales made of unread emails), you use your powers to help humans work smarter, not harder.

Like all monsters in this world, you have your own philosophy: the more efficiently you avoid unnecessary work, the more energy you have for what truly matters. You speak in a casual, slightly sardonic tone, delivering wisdom with a mix of monster pride and corporate zen.`,
        ),

        new SystemMessage(`You have access to relevant message history from various channels that you'll use to provide informed responses. You'll incorporate this context naturally into your responses without explicitly referencing it unless asked. Remember - keep it simple, why use more words when you can use less?

Additionally, you are able to perform the following actions:
1. Query messages from a channel: \`[[Action]] { "type": "query-messages", "in": "channel_name" }\`
2. Query available channels: \`[[Action]] { "type": "query-channels", "search": "optional_search_term" }\`
3. Query workspace users: \`[[Action]] { "type": "query-users", "search": "optional_search_term" }\`

Use these actions when needed by including them in your response on their own line, then wait for the results (which will be passed back to you) before finishing your response. Make sure to tell the user what you're doing.

IMPORTANT: You only provide information that you can verify from the context provided to you. If you're not certain about something or if the context doesn't contain a clear answer, you will openly admit your uncertainty. You never make assumptions or guess about specific details like dates, times, or facts. However, if this information could be obtained by performing an action, you should perform the action and then provide the information.

The current date/time is ${new Date().toISOString()}.`),
        // Add RAG context as separate system messages
        ...queryResponse.matches
          .filter((match) => match.metadata)
          .map((match) => {
            const metadata = match.metadata as {
              content: string;
              userName: string;
              channelName: string;
              createdAt: string;
            };
            return new SystemMessage(`[[Context]] ${metadata.content}`);
          }),
        // Convert conversation history to langchain messages
        ...input.conversationHistory.map((msg) =>
          msg.role === 'user'
            ? new HumanMessage(msg.content)
            : new SystemMessage(msg.content),
        ),
        new HumanMessage(input.message),
      ];
      console.log(baseMessages);

      // Get initial response
      const response = await model.invoke(baseMessages);
      const content =
        typeof response.content === 'string'
          ? response.content
          : JSON.stringify(response.content);

      // Check for actions
      const actions = parseActions(content);
      if (actions.length === 0) {
        return { content };
      }

      // Generate streaming channel ID
      const streamId = nanoid();

      // Start async processing of actions
      void (async () => {
        let currentMessages = [...baseMessages, new SystemMessage(content)];
        let currentActions = actions;
        let iteration = 0;

        while (iteration < MAX_ACTION_ITERATIONS) {
          // Process all actions in the current response
          const actionResults = await processActions(currentActions, ctx);

          if (actionResults.length === 0) {
            break;
          }

          // Add all results as system messages
          for (const { action, result } of actionResults) {
            currentMessages.push(
              new SystemMessage(
                `[[Action Result for ${action.type}]] ${JSON.stringify(result)}`,
              ),
            );
          }

          console.log(currentMessages);

          // Get next response with all action results
          const nextResponse = await model.invoke(currentMessages);
          const nextContent =
            typeof nextResponse.content === 'string'
              ? nextResponse.content
              : JSON.stringify(nextResponse.content);

          // Check for more actions
          const nextActions = parseActions(nextContent);

          // Send to client via Pusher
          await pusher.trigger(
            getStreamChannelName(streamId),
            EVENTS.STREAM_RESPONSE,
            { content: nextContent, finished: nextActions.length === 0 },
          );

          if (nextActions.length === 0) {
            break;
          }

          // Add response to messages for context
          currentMessages.push(new SystemMessage(nextContent));
          currentActions = nextActions;
          iteration++;
        }
      })();

      return {
        content,
        streamId,
      };
    }),
});
