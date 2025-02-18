import ChannelView from '@/components/channel-view';
import { api } from '@/trpc/server';
import { Channel, Message } from '@prisma/client';
import { notFound } from 'next/navigation';
import { cache } from 'react';

const getChannel = cache(
  async (
    channelId: string,
  ): Promise<{ channel: Channel; messages: Message[] }> => {
    const channel = await api.channel.getById({
      channelId,
    });

    if (!channel) {
      throw new Error('Channel not found');
    }

    const messagesResult = await api.message.getAll({
      channelId,
      limit: 50,
    });

    return {
      channel,
      messages: messagesResult.messages,
    };
  },
);

interface Props {
  params: Promise<{
    channelId: string;
  }>;
}

export default async function ChannelPage({ params }: Props) {
  const { channelId } = await params;
  const result = await getChannel(channelId);
  if (!result.channel) return notFound();

  return (
    <ChannelView channel={result.channel} initialMessages={result.messages} />
  );
}

// Generate metadata for the page
export async function generateMetadata({ params }: Props) {
  const { channelId } = await params;
  const result = await getChannel(channelId);
  if (!result.channel) return;

  return {
    title: `${result.channel.name} | Workspace`,
  };
}
