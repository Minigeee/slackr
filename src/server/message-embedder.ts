import { htmlToMarkdown } from '@/utils/markdown';
import { clerkClient, User } from '@clerk/nextjs/server';
import { Message } from '@prisma/client';
import { db } from './db';
import { getEmbeddings } from './embeddings';
import { index } from './pinecone';

const MIN_TOKENS = 5; // Only embed messages longer than this, unless they have mentions
const MAX_THREAD_CHUNK_TOKENS = 1000; // Maximum tokens per thread chunk

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
  createdAt: number;
  threadId?: string;
  parentId?: string;
  isThread: boolean;
  isDm: boolean;
};

function formatMessageText(
  userName: string,
  channelName: string,
  message: Message,
): string {
  return `Message from ${userName} at ${message.createdAt.toISOString()} in #${channelName}: ${htmlToMarkdown(message.content)}`;
}

export async function embedThread(
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

  if (!messages.length) return;

  // Get map of sender ids to names
  const senderIds = new Set(messages.map((msg) => msg.userId));
  const client = await clerkClient();
  const senders = await client.users.getUserList({
    userId: Array.from(senderIds),
  });
  const senderMap = new Map(
    senders.data.map((sender) => [sender.id, getUserName(sender)]),
  );

  // Format messages with sender names
  const formattedMessages = messages.map((msg: Message) => {
    const userName = senderMap.get(msg.userId) || `Unknown User`;
    return formatMessageText(userName, metadata.channelName, msg);
  });

  // Split messages into chunks based on token count
  const chunks: string[] = [];
  let currentChunk: string[] = [];
  let currentChunkTokens = 0;

  for (const message of formattedMessages) {
    const messageTokens = estimateTokens(message);

    // If adding this message would exceed the chunk limit, start a new chunk
    if (
      currentChunkTokens + messageTokens > MAX_THREAD_CHUNK_TOKENS &&
      currentChunk.length > 0
    ) {
      chunks.push(currentChunk.join('\n\n'));
      currentChunk = [];
      currentChunkTokens = 0;
    }

    currentChunk.push(message);
    currentChunkTokens += messageTokens;
  }

  // Add the last chunk if it has any messages
  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join('\n\n'));
  }

  // Generate embeddings and store each chunk
  await Promise.all(
    chunks.map(async (chunk, i) => {
      const embeddings = await getEmbeddings([chunk]);
      if (!embeddings[0]?.values) {
        throw new Error('Failed to generate embedding for thread chunk');
      }

      // Store in Pinecone with thread metadata and chunk info
      await index.upsert([
        {
          id: chunks.length === 1 ? threadId : `${threadId}_chunk_${i}`,
          values: embeddings[0].values,
          metadata: {
            messageId: threadId,
            content: chunk,
            ...metadata,
            isThread: true,
            isChunk: chunks.length > 1,
            chunkIndex: i,
            totalChunks: chunks.length,
          },
        },
      ]);
    }),
  );
}

export async function embedMessage(
  message: Message,
  metadata: Omit<MessageMetadata, 'messageId'>,
) {
  if (metadata.isDm) metadata.channelName = 'DM';

  // If message is part of a thread, update thread embedding
  if (message.threadId) {
    await embedThread(message.threadId, metadata);
    return;
  }

  // Check if message should be embedded individually
  const tokens = estimateTokens(message.content);
  if (tokens < MIN_TOKENS && !hasMentions(message.content) && !metadata.isDm) {
    console.log('skipping message with tokens', tokens);
    return; // Skip embedding for short messages without mentions
  }

  // Format message text
  const text = formatMessageText(
    metadata.userName,
    metadata.channelName,
    message,
  );

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

export async function deleteMessageEmbedding(messageId: string) {
  await index.deleteOne(messageId);
}
