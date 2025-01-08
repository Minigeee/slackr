'use client';

import { useCallback, useEffect, useState, useMemo } from 'react';
import MessageView from '@/components/message-view';
import { Channel, Message } from '@prisma/client';
import { api } from '@/trpc/react';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@clerk/nextjs';
import { EVENTS, pusherClient } from '@/utils/pusher';
import { subscribeToChannel, unsubscribeFromChannel } from '@/utils/pusher';
import { User } from '@/types/user';
import { useWorkspace } from '@/contexts/workspace-context';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ChannelProvider, useChannel } from '@/contexts/channel-context';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { MessageWithUser } from '@/types/message';

interface ThreadViewProps {
  threadId: string;
  messages: Message[];
  onClose: () => void;
  onSendMessage: (
    content: string,
    threadId?: string,
  ) => Promise<Message | null>;
}

function ThreadView({
  threadId,
  messages,
  onClose,
  onSendMessage,
}: ThreadViewProps) {
  return (
    <div className='flex h-full w-[400px] xl:w-[500px] flex-col border-l'>
      <div className='flex h-12 items-center justify-between border-b px-4'>
        <h3 className='font-semibold'>Thread</h3>
        <Button variant='ghost' size='sm' onClick={onClose}>
          <X className='h-4 w-4' />
        </Button>
      </div>
      <MessageView
        messages={messages}
        onSendMessage={onSendMessage}
        threadId={threadId}
      />
    </div>
  );
}

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
  // Handle active thread state
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);

  // Handle sending a message
  const handleSendMessage = useCallback(
    async (content: string, threadId?: string) => {
      if (!user?.id) return null;

      // Optimistically add message to local state
      const newMessage: Message = {
        id: `temp-${Date.now()}`,
        createdAt: new Date(),
        content,
        userId: user?.id,
        channelId: channel.id,
        parentId: null,
        threadId: threadId ?? null,
        updatedAt: new Date(),
      };
      setMessages((prev) => [newMessage, ...prev]);

      const message = await createMessage({
        channelId: channel.id,
        content,
        threadId,
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
    },
    [createMessage, user?.id, channel.id, setMessages, toast],
  );

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

    pusherChannel.bind(
      EVENTS.NEW_MESSAGE,
      async (message: Message & { user: User }) => {
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
      },
    );

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
    <ChannelProvider
      activeThreadId={activeThreadId}
      setActiveThreadId={setActiveThreadId}
    >
      <div className='flex h-full w-full'>
        <div className='flex h-full flex-1 flex-col'>
          <div className='flex h-12 items-center border-b px-4'>
            {channel.type === 'dm' ? (
              <>
                {/* For DM channels, show the other user's info */}
                {(() => {
                  const [, user1, user2] = channel.name.split('-');
                  const otherUserId = user1 === user?.id ? user2 : user1;
                  if (!otherUserId) return null;
                  const otherUser = workspace.members[otherUserId];

                  return (
                    <div className='flex items-center'>
                      <Avatar className='mr-2 h-8 w-8'>
                        <AvatarImage src={otherUser?.profilePicture} />
                        <AvatarFallback>
                          {otherUser?.firstName?.charAt(0) ??
                            otherUser?.email?.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <span className='font-semibold'>
                        {otherUser?.firstName
                          ? `${otherUser.firstName} ${otherUser.lastName}`
                          : otherUser?.email}
                      </span>
                    </div>
                  );
                })()}
              </>
            ) : (
              <h2 className='font-semibold'>#{channel.name}</h2>
            )}
          </div>
          <MessageView
            messages={messages}
            onSendMessage={handleSendMessage}
          />
        </div>
        {activeThreadId && (
          <ThreadView
            threadId={activeThreadId}
            messages={messages}
            onClose={() => setActiveThreadId(null)}
            onSendMessage={handleSendMessage}
          />
        )}
      </div>
    </ChannelProvider>
  );
}
