'use client';

import { type Message } from '@prisma/client';
import MessageList from './message-list';
import MessageInput from './message-input';
import { ScrollArea } from '../ui/scroll-area';
import { User } from '@/types/user';
import { useClerk } from '@clerk/nextjs';
import { useMemo, useState, useRef, useEffect } from 'react';
import { useWorkspace } from '@/contexts/workspace-context';
import { useToast } from '@/hooks/use-toast';
import { Button } from '../ui/button';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EVENTS, subscribeToChannel } from '@/utils/pusher';

interface MessageWithUser extends Message {
  user: User;
}

interface MessageViewProps {
  messages: Message[];
  onSendMessage: (content: string) => Promise<Message>;
}

const MessageView = (props: MessageViewProps) => {
  const workspace = useWorkspace();
  const { user } = useClerk();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>(props.messages);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);

  const messagesWithUser = useMemo(() => {
    return messages.map((message) => {
      return {
        ...message,
        user: workspace.members[message.userId],
      } as MessageWithUser;
    });
  }, [messages, workspace.members]);

  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector(
        '[data-radix-scroll-area-viewport]',
      );
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  };

  const handleScroll = () => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector(
        '[data-radix-scroll-area-viewport]',
      );
      if (scrollContainer) {
        const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
        setShowScrollButton(!isNearBottom);
      }
    }
  };

  // Setup scroll event listener
  useEffect(() => {
    const scrollContainer = scrollAreaRef.current?.querySelector(
      '[data-radix-scroll-area-viewport]',
    );
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll);
      return () => scrollContainer.removeEventListener('scroll', handleScroll);
    }
  }, []);

  // Scroll to bottom on initial load and when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messagesWithUser.length]);

  const handleSendMessage = async (content: string) => {
    if (!user?.id) return;

    // Create optimistic message
    const optimisticMessage: Message = {
      id: `temp-${Date.now()}`,
      content,
      userId: user.id,
      channelId: messages[0]?.channelId ?? '', // Get channelId from existing messages
      createdAt: new Date(),
      updatedAt: new Date(),
      parentId: null,
    };

    setMessages((prev) => [optimisticMessage, ...prev]);

    try {
      await props.onSendMessage(content);
      setMessages((prev) =>
        prev.filter((msg) => msg.id !== optimisticMessage.id),
      );
    } catch (error) {
      setMessages((prev) =>
        prev.filter((msg) => msg.id !== optimisticMessage.id),
      );
      toast({
        title: 'Error sending message',
        description: 'Your message could not be sent. Please try again.',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    // Subscribe to Pusher channel
    const channelId = messages[0]?.channelId;
    if (!channelId) return;

    const channel = subscribeToChannel(channelId);

    // Handle new messages
    channel.bind(EVENTS.NEW_MESSAGE, async (message: MessageWithUser) => {
      // Check if we have the sender's info
      const sender = workspace.members[message.user.id];
      if (!sender) {
        // Add sender to members
        workspace._mutators.setMembers((prev) => ({
          ...prev,
          [message.user.id]: message.user,
        }));
      }

      setMessages((prev) => {
        const idx = prev.findIndex((msg) => msg.id === message.id);
        if (idx >= 0) return prev;
        return [message, ...prev];
      });
    });

    // Handle message updates
    channel.bind(EVENTS.UPDATE_MESSAGE, (updatedMessage: Message) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === updatedMessage.id ? updatedMessage : msg,
        ),
      );
    });

    // Handle message deletions
    channel.bind(
      EVENTS.DELETE_MESSAGE,
      ({ messageId }: { messageId: string }) => {
        setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
      },
    );

    // Cleanup on unmount
    return () => {
      channel.unbind_all();
      channel.unsubscribe();
    };
  }, [messages]);

  return (
    <div className='relative flex h-full flex-1 flex-col overflow-hidden'>
      <ScrollArea ref={scrollAreaRef} className='flex-1'>
        <div className='p-4'>
          <MessageList messages={messagesWithUser} />
        </div>
      </ScrollArea>
      <Button
        variant='secondary'
        size='icon'
        className={cn(
          'absolute bottom-40 right-4 z-10 rounded-full shadow-md transition-opacity',
          showScrollButton ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={scrollToBottom}
      >
        <ChevronDown className='h-4 w-4' />
      </Button>
      <div className='border-t bg-background p-4'>
        <MessageInput onSend={handleSendMessage} />
      </div>
    </div>
  );
};

export default MessageView;
