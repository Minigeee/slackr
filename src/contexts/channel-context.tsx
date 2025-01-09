'use client';

import { Channel, Message } from '@prisma/client';
import { createContext, useContext, useState, ReactNode, useCallback, useEffect, useMemo } from 'react';
import { EVENTS, pusherClient, getChannelName, unsubscribeFromChannel, subscribeToChannel } from '@/utils/pusher';
import { useUser } from '@clerk/nextjs';
import { AttachmentWithStatus, FullMessage, MessageWithUser } from '@/types/message';
import { useWorkspace } from './workspace-context';
import { api } from '@/trpc/react';
import { User } from '@/types/user';
import { useToast } from '@/hooks/use-toast';

interface TypingUser {
  id: string;
  name: string;
  timestamp: number;
}

interface ChannelContextType {
  /** The channel */
  channel: Channel;
  /** The messages in the channel */
  messages: FullMessage[];
  /** Send a message to the channel */
  sendMessage: (content: string, attachments: File[], threadId?: string) => Promise<Message | null>;
  /** The ID of the active thread, if any */
  activeThreadId: string | null;
  /** Set the active thread ID */
  setActiveThreadId: (id: string | null) => void;
  /** Toggle a reaction on a message */
  toggleReaction: (messageId: string, emoji: string) => Promise<void>;
  /** The users currently typing in the channel */
  typingUsers: TypingUser[];
  /** Start typing in the channel */
  startTyping: () => void;
  /** Stop typing in the channel */
  stopTyping: () => void;
}

const ChannelContext = createContext<ChannelContextType | null>(null);

export function useChannel() {
  const context = useContext(ChannelContext);
  if (!context) {
    throw new Error('useChannel must be used within a ChannelProvider');
  }
  return context;
}

interface ChannelProviderProps {
  children: ReactNode;
  channel: Channel;
  initialMessages: Omit<FullMessage, 'user'>[];
}

export function ChannelProvider(props: ChannelProviderProps) {
  const { user } = useUser();
  const { toast } = useToast();
  const workspace = useWorkspace();

  // Handle messages state locally bc they will be updated in real-time
  const [messages, setMessages] = useState<Omit<FullMessage, 'user'>[]>(props.initialMessages);
  const { mutateAsync: createMessage } = api.message.create.useMutation();
  const { mutateAsync: getUploadUrl } =
    api.attachment.getUploadUrl.useMutation();
  const { mutateAsync: toggleReactionMutation } = api.message.toggleReaction.useMutation();

  // Handle active thread state
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);

  // Handle typing state
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [isTyping, setIsTyping] = useState(false);

  // Clean up stale typing indicators after 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setTypingUsers(prev => prev.filter(user => now - user.timestamp < 3000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

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
        channelId: props.channel.id,
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
          channelId: props.channel.id,
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
    [createMessage, user?.id, props.channel.id, setMessages, toast, getUploadUrl],
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
    const channelId = props.channel.id;
    console.log('Setting up subscription for channel:', channelId);

    const pusherChannel = subscribeToChannel(channelId);

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
    
    pusherChannel.bind(EVENTS.TYPING_START, (data: { userId: string; name: string; }) => {
      console.log('Typing start', data);
      if (data.userId === user?.id) return;

      setTypingUsers(prev => {
        const existing = prev.find(u => u.id === data.userId);
        if (existing) {
          return prev.map(u => 
            u.id === data.userId 
              ? { ...u, timestamp: Date.now() }
              : u
          );
        }
        return [...prev, { id: data.userId, name: data.name, timestamp: Date.now() }];
      });
    });

    pusherChannel.bind(EVENTS.TYPING_STOP, (data: { userId: string; }) => {
      if (data.userId === user?.id) return;
      console.log('Typing stop', data);
      setTypingUsers(prev => prev.filter(u => u.id !== data.userId));
    });

    // Cleanup on unmount
    return () => {
      console.log('Cleanup: unsubscribing from channel:', channelId);
      pusherChannel.unbind_all();
      unsubscribeFromChannel(channelId);
    };
  }, [props.channel.id, user?.id, workspace._mutators.setMembers]);

  const startTyping = useCallback(() => {
    if (isTyping) return; // Don't send event if already typing
    setIsTyping(true);
    const channel = pusherClient.channel(getChannelName(props.channel.id));
    console.log('Starting typing', EVENTS.TYPING_START, channel);
    channel?.trigger(EVENTS.TYPING_START, {
      userId: user?.id ?? '',
      name: user?.firstName ?? user?.emailAddresses[0]?.emailAddress ?? '',
    });
  }, [props.channel.id, user?.id, isTyping]);

  const stopTyping = useCallback(() => {
    if (!isTyping) return; // Don't send event if not typing
    setIsTyping(false);
    console.log('Stopping typing');
    pusherClient.channel(getChannelName(props.channel.id))?.trigger(EVENTS.TYPING_STOP, {
      userId: user?.id ?? '',
    });
  }, [props.channel.id, user?.id, isTyping]);

  return (
    <ChannelContext.Provider
      value={{
        channel: props.channel,
        messages: messagesWithUser,
        sendMessage: handleSendMessage,
        activeThreadId,
        setActiveThreadId,
        toggleReaction: handleToggleReaction,
        typingUsers,
        startTyping,
        stopTyping,
      }}
    >
      {props.children}
    </ChannelContext.Provider>
  );
} 