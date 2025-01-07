'use client';

import { useEffect, useState } from 'react';
import MessageView from '@/components/message-view';
import { Channel, Message } from '@prisma/client';
import { api } from '@/trpc/react';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@clerk/nextjs';
import assert from 'assert';
import { EVENTS, pusherClient } from '@/utils/pusher';
import { subscribeToChannel, unsubscribeFromChannel } from '@/utils/pusher';
import { User } from '@/types/user';
import { useWorkspace } from '@/contexts/workspace-context';

interface ChannelViewProps {
  channel: Channel;
  initialMessages: Message[];
}

export default function ChannelView({
  channel,
  initialMessages,
}: ChannelViewProps) {
  const { toast } = useToast();
  const { user } = useUser();
  const workspace = useWorkspace();

  // Handle messages state locally bc they will be updated in real-time
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const { mutateAsync: createMessage } = api.message.create.useMutation();

  // Handle sending a message
  const handleSendMessage = async (content: string) => {
    if (!user?.id) return null;

    // Optimistically add message to local state
    const newMessage: Message = {
      id: `temp-${Date.now()}`,
      createdAt: new Date(),
      content,
      userId: user?.id,
      channelId: channel.id,
      parentId: null,
      updatedAt: new Date(),
    };
    setMessages((prev) => [newMessage, ...prev]);

    const message = await createMessage({
      channelId: channel.id,
      content,
    })
      .then((msg) => {
        // Replace the optimistic message with the actual message
        setMessages((prev) =>
          prev.map((old) => (old.id === newMessage.id ? msg : old)),
        );
        return msg;
      })
      .catch((error) => {
        console.error('Error sending message', error);

        // Remove the optimistic message from local state
        setMessages((prev) => prev.filter((msg) => msg.id !== newMessage.id));

        toast({
          title: 'Error sending message',
          description: 'Your message could not be sent. Please try again.',
          variant: 'destructive',
        });

        return null;
      });
    return message;
  };

  // Subscribe to real-time updates
  useEffect(() => {
    const channelId = channel.id;
    console.log('Setting up subscription for channel:', channelId);

    const pusherChannel = subscribeToChannel(channelId);
    
    // Debug Pusher connection state
    console.log('Pusher connection state:', pusherClient.connection.state);

    pusherChannel.bind('pusher:subscription_succeeded', () => {
      console.log('Successfully subscribed to channel:', channelId);
    });

    pusherChannel.bind('pusher:subscription_error', (error: any) => {
      console.error('Failed to subscribe to channel:', channelId, error);
    });

    pusherChannel.bind(EVENTS.NEW_MESSAGE, async (message: Message & { user: User }) => {
      console.log('new message event received:', message);
      // Check if we have the sender's info
      const sender = workspace.members[message.user.id];
      if (!sender) {
        // Add sender to members
        workspace._mutators.setMembers((prev) => ({
          ...prev,
          [message.user.id]: message.user,
        }));
      }

      // Only add message if it's not from the current user
      if (message.userId !== user?.id) {
        setMessages((prev) => [message, ...prev]);
      }
    });

    // Handle message updates
    pusherChannel.bind(EVENTS.UPDATE_MESSAGE, (updatedMessage: Message) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === updatedMessage.id ? updatedMessage : msg,
        ),
      );
    });

    // Handle message deletions
    pusherChannel.bind(
      EVENTS.DELETE_MESSAGE,
      ({ messageId }: { messageId: string }) => {
        setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
      },
    );

    // Cleanup on unmount
    return () => {
      console.log('Cleanup: unsubscribing from channel:', channelId);
      pusherChannel.unbind_all();
      unsubscribeFromChannel(channelId);
    };
  }, [channel.id, user?.id, workspace._mutators.setMembers]);

  return (
    <div className='flex h-full w-full flex-col'>
      <div className='flex h-12 items-center border-b px-4'>
        <h2 className='font-semibold'>#{channel.name}</h2>
      </div>
      <MessageView messages={messages} onSendMessage={handleSendMessage} />
    </div>
  );
}
