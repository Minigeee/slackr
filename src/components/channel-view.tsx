'use client';

import { useState } from 'react';
import MessageView from '@/components/message-view';
import { Channel, Message } from '@prisma/client';
import { api } from '@/trpc/react';

interface ChannelViewProps {
  channel: Channel;
  initialMessages: Message[];
}

export default function ChannelView({
  channel,
  initialMessages,
}: ChannelViewProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const { mutateAsync: createMessage } = api.message.create.useMutation({
    onSuccess: (newMessage) => {
      setMessages((prev) => [newMessage, ...prev]);
    },
  });

  const handleSendMessage = async (content: string) => {
    const message = await createMessage({
      channelId: channel.id,
      content,
    });
    return message;
  };

  return (
    <div className='flex h-full w-full flex-col'>
      <div className='flex h-12 items-center border-b px-4'>
        <h2 className='font-semibold'>#{channel.name}</h2>
      </div>
      <MessageView messages={messages} onSendMessage={handleSendMessage} />
    </div>
  );
}
