import { htmlToMarkdown } from '@/utils/markdown';
import { clerkClient, User } from '@clerk/nextjs/server';
import { Message } from '@prisma/client';
import { db } from './db';
import { getEmbeddings } from './embeddings';
import { index } from './pinecone';

const MIN_TOKENS = 15; // Only embed messages longer than this, unless they have mentions

// Rough token count estimation - can be refined based on your needs
function estimateTokens(text: string): number {
  return Math.ceil(text.split(/\s+/).length * 1.3);
}

// Check if message contains mentions (channels or users)
function hasMentions(text: string): boolean {
  return text.includes('@') || text.includes('#');
}

// Get user name from clerk
function getUserName(user: User): string {
  return user.firstName
    ? user.firstName + ' ' + user.lastName
    : (user.emailAddresses[0]?.emailAddress ?? 'Unknown User');
}

type MessageMetadata = {
  messageId: string;
  channelId: string;
  channelName: string;
  workspaceId: string;
  workspaceName: string;
  userId: string;
  userName: string;
  createdAt: string;
  threadId?: string;
  parentId?: string;
  isThread: boolean;
};

function formatMessageText(userName: string, content: string): string {
  return `${userName}: ${htmlToMarkdown(content)}`;
}

async function embedThread(
  threadId: string,
  metadata: Omit<MessageMetadata, 'messageId'>,
) {
  // Get all messages in the thread
  const messages = await db.message.findMany({
    where: {
      OR: [
        { id: threadId }, // Thread parent
        { threadId: threadId }, // Thread replies
      ],
    },
    orderBy: { createdAt: 'asc' },
  });

  // Get map of sender ids to names
  const senderIds = new Set(messages.map((msg) => msg.userId));
  const client = await clerkClient();
  const senders = await client.users.getUserList({
    userId: Array.from(senderIds),
  });
  const senderMap = new Map(
    senders.data.map((sender) => [sender.id, getUserName(sender)]),
  );

  if (!messages.length) return;

  // Format messages with sender names
  const combinedText = messages
    .map((msg: Message) => {
      const userName = senderMap.get(msg.userId) || `Unknown User`;
      return formatMessageText(userName, msg.content);
    })
    .join('\n\n');

  // Generate embedding for the entire thread
  const embeddings = await getEmbeddings([combinedText]);
  if (!embeddings[0]?.values) {
    throw new Error('Failed to generate embedding for thread');
  }

  // Store in Pinecone with thread metadata
  await index.upsert([
    {
      id: threadId,
      values: embeddings[0].values,
      metadata: {
        messageId: threadId,
        content: combinedText,
        ...metadata,
        isThread: true,
      },
    },
  ]);
}

export async function embedMessage(
  message: Message,
  metadata: Omit<MessageMetadata, 'messageId'>,
) {
  // If message is part of a thread, update thread embedding
  if (message.threadId) {
    await embedThread(message.threadId, metadata);
    return;
  }

  // Check if message should be embedded individually
  const tokens = estimateTokens(message.content);
  if (tokens < MIN_TOKENS && !hasMentions(message.content)) {
    console.log('skipping message with tokens', tokens);
    return; // Skip embedding for short messages without mentions
  }

  // Get previous message for context
  const previousMessage = await db.message.findFirst({
    where: {
      channelId: message.channelId,
      createdAt: { lt: message.createdAt },
      threadId: null,
    },
    orderBy: { createdAt: 'desc' },
  });

  let text = formatMessageText(metadata.userName, message.content);

  // Format text with previous message context if it exists
  if (previousMessage) {
    const client = await clerkClient();
    const prevSender = await client.users.getUser(previousMessage?.userId);

    const prevUserName =
      previousMessage.userId === metadata.userId
        ? metadata.userName
        : getUserName(prevSender);
    const prevText = formatMessageText(prevUserName, previousMessage.content);
    text = `${prevText}\n\n${text}`;
  }

  // Generate and store embedding
  const embeddings = await getEmbeddings([text]);
  if (!embeddings[0]?.values) {
    throw new Error('Failed to generate embedding');
  }

  await index.upsert([
    {
      id: message.id,
      values: embeddings[0].values,
      metadata: {
        messageId: message.id,
        content: text,
        ...metadata,
        threadId: message.threadId ?? '',
        parentId: message.parentId ?? '',
        isThread: false,
      },
    },
  ]);
}
