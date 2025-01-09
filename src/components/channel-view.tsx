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
import {
  AttachmentWithStatus,
  FullMessage,
  MessageWithUser,
} from '@/types/message';
import { generateUploadPresignedUrl, getFileUrl } from '@/server/s3';
import { UserAvatar } from './user-avatar';

interface ThreadViewProps {
  threadId: string;
  messages: FullMessage[];
  onClose: () => void;
  onSendMessage: (
    content: string,
    attachments: File[],
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
    <div className='flex h-full w-[400px] flex-col border-l xl:w-[500px]'>
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
  initialMessages: Omit<FullMessage, 'user'>[];
}

export default function ChannelView({
  channel,
  initialMessages,
}: ChannelViewProps) {
  const { toast } = useToast();
  const { user } = useUser();
  const workspace = useWorkspace();

  // Handle messages state locally bc they will be updated in real-time
  const [messages, setMessages] = useState<Omit<FullMessage, 'user'>[]>(initialMessages);
  const { mutateAsync: createMessage } = api.message.create.useMutation();
  const { mutateAsync: getUploadUrl } =
    api.attachment.getUploadUrl.useMutation();
  const { mutateAsync: toggleReactionMutation } = api.message.toggleReaction.useMutation();
  // Handle active thread state
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);

  // Map messages to include user info and filter based on thread mode
  const messagesWithUser = useMemo<FullMessage[]>(() => {
    const withUser = messages.map((message) => {
      return {
        ...message,
        user: workspace.members[message.userId],
      } as MessageWithUser;
    });

    const threads = new Map<string, Message[]>();
    withUser.forEach((message) => {
      if (message.threadId) {
        const thread = threads.get(message.threadId) || [];
        thread.push(message);
        threads.set(message.threadId, thread);
      }
    });

    return withUser.map((message) => {
      return {
        ...message,
        replies: threads.get(message.id),
      } as FullMessage;
    });
  }, [messages, workspace.members]);

  // Handle sending a message
  const handleSendMessage = useCallback(
    async (content: string, attachments: File[], threadId?: string) => {
      if (!user?.id) return null;

      // Create optimistic attachments
      const optimisticAttachments: AttachmentWithStatus[] = attachments.map(
        (file) => ({
          id: `temp-${Math.random().toString(36).substring(7)}`,
          key: `attachments/${Math.random().toString(36).substring(7)}${file.name.substring(file.name.lastIndexOf('.'))}`,
          filename: file.name,
          mimeType: file.type,
          size: file.size,
          isUploading: true,
          createdAt: new Date(),
          height: null,
          width: null,
          messageId: '',
          url: '',
        }),
      );

      // Optimistically add message to local state
      const newMessage: FullMessage = {
        id: `temp-${Date.now()}`,
        createdAt: new Date(),
        content,
        userId: user?.id,
        channelId: channel.id,
        parentId: null,
        threadId: threadId ?? null,
        updatedAt: new Date(),
        attachments: optimisticAttachments,
      };
      setMessages((prev) => [newMessage, ...prev]);

      try {
        // Upload files first
        const uploadedAttachments = await Promise.all(
          attachments.map(async (file, index) => {
            const { presignedUrl, key } = await getUploadUrl({
              filename: file.name,
              contentType: file.type,
            });

            // Upload file
            await fetch(presignedUrl, {
              method: 'PUT',
              body: file,
              headers: {
                'Content-Type': file.type,
              },
            });

            // Get image dimensions if it's an image
            let width: number | undefined;
            let height: number | undefined;
            if (file.type.startsWith('image/')) {
              const dimensions = await new Promise<{
                width: number;
                height: number;
              }>((resolve, reject) => {
                const img = new Image();
                img.onload = () => {
                  resolve({ width: img.width, height: img.height });
                };
                img.onerror = reject;
                img.src = URL.createObjectURL(file);
              });
              width = dimensions.width;
              height = dimensions.height;
            }

            return {
              key,
              filename: file.name,
              mimeType: file.type,
              size: file.size,
              width,
              height,
            };
          }),
        );

        // Create message with attachments
        const message = await createMessage({
          channelId: channel.id,
          content,
          threadId,
          attachments: uploadedAttachments,
        });

        // Replace the optimistic message with the actual message
        setMessages((prev) =>
          prev.map((old) => (old.id === newMessage.id ? message : old)),
        );
        return message;
      } catch (error) {
        console.error('Error sending message', error);

        // Remove the optimistic message from local state
        setMessages((prev) => prev.filter((msg) => msg.id !== newMessage.id));

        toast({
          title: 'Error sending message',
          description: 'Your message could not be sent. Please try again.',
          variant: 'destructive',
        });

        return null;
      }
    },
    [createMessage, user?.id, channel.id, setMessages, toast, getUploadUrl],
  );

  // Handle toggling reactions
  const handleToggleReaction = useCallback(async (messageId: string, emoji: string) => {
    if (!user?.id) return;

    // Optimistically update the reaction
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id === messageId) {
          const existingReaction = msg.reactions?.find(
            (r) => r.userId === user.id && r.emoji === emoji
          );

          if (existingReaction) {
            // Remove reaction
            return {
              ...msg,
              reactions: msg.reactions?.filter(
                (r) => !(r.userId === user.id && r.emoji === emoji)
              ),
            };
          } else {
            // Add reaction
            return {
              ...msg,
              reactions: [
                ...(msg.reactions || []),
                {
                  id: `temp-${Date.now()}`,
                  emoji,
                  userId: user.id,
                  messageId,
                  createdAt: new Date(),
                },
              ],
            };
          }
        }
        return msg;
      })
    );

    try {
      await toggleReactionMutation({ messageId, emoji });
    } catch (error) {
      console.error('Error toggling reaction:', error);
      // Revert optimistic update on error
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id === messageId) {
            const existingReaction = msg.reactions?.find(
              (r) => r.userId === user.id && r.emoji === emoji
            );

            if (existingReaction) {
              // Add reaction back
              return {
                ...msg,
                reactions: [
                  ...(msg.reactions?.filter(
                    (r) => !(r.userId === user.id && r.emoji === emoji)
                  ) || []),
                  existingReaction,
                ],
              };
            } else {
              // Remove reaction
              return {
                ...msg,
                reactions: msg.reactions?.filter(
                  (r) => !(r.userId === user.id && r.emoji === emoji)
                ),
              };
            }
          }
          return msg;
        })
      );

      toast({
        title: 'Error toggling reaction',
        description: 'Your reaction could not be saved. Please try again.',
        variant: 'destructive',
      });
    }
  }, [user?.id, toggleReactionMutation, toast]);

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

    pusherChannel.bind(EVENTS.NEW_MESSAGE, async (message: FullMessage) => {
      console.log('new message event received:', message);
      // Check if we have the sender's info
      const sender = message.user
        ? workspace.members[message.user.id]
        : undefined;
      if (!sender && message.user) {
        // Add sender to members
        workspace._mutators.setMembers((prev) =>
          message.user
            ? {
                ...prev,
                [message.user.id]: message.user,
              }
            : prev,
        );
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

    // Handle reactions
    pusherChannel.bind(
      EVENTS.ADD_REACTION,
      ({ messageId, emoji, userId, user }: { messageId: string; emoji: string; userId: string; user: User }) => {
        // Ignore if the reaction is from the current user
        if (userId === user?.id) return;

        // Add sender to members if not already present
        if (user && !workspace.members[user.id]) {
          workspace._mutators.setMembers((prev) => ({
            ...prev,
            [user.id]: user,
          }));
        }

        setMessages((prev) =>
          prev.map((msg) => {
            if (msg.id === messageId) {
              return {
                ...msg,
                reactions: [
                  ...(msg.reactions || []),
                  {
                    id: `${userId}-${emoji}`,
                    emoji,
                    userId,
                    messageId,
                    createdAt: new Date(),
                  },
                ],
              };
            }
            return msg;
          })
        );
      }
    );

    pusherChannel.bind(
      EVENTS.REMOVE_REACTION,
      ({ messageId, emoji, userId }: { messageId: string; emoji: string; userId: string }) => {
        setMessages((prev) =>
          prev.map((msg) => {
            if (msg.id === messageId) {
              return {
                ...msg,
                reactions: (msg.reactions || []).filter(
                  (reaction) => !(reaction.userId === userId && reaction.emoji === emoji)
                ),
              };
            }
            return msg;
          })
        );
      }
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
      toggleReaction={handleToggleReaction}
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
                      <UserAvatar user={otherUser ?? null} className='h-8 w-8' />
                      <span className='font-semibold ml-2'>
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
          <MessageView messages={messagesWithUser} onSendMessage={handleSendMessage} />
        </div>
        {activeThreadId && (
          <ThreadView
            threadId={activeThreadId}
            messages={messagesWithUser}
            onClose={() => setActiveThreadId(null)}
            onSendMessage={handleSendMessage}
          />
        )}
      </div>
    </ChannelProvider>
  );
}
