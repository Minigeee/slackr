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

interface MessageWithUser extends Message {
  user: User;
}

interface MessageViewProps {
  messages: Message[];
  onSendMessage: (content: string) => Promise<Message>;
}

const MessageView = ({ messages, onSendMessage }: MessageViewProps) => {
  const { workspaceMembers } = useWorkspace();
  const { user } = useClerk();
  const { toast } = useToast();
  const [optimisticMessages, setOptimisticMessages] = useState<Message[]>([]);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);

  const allMessages = [...optimisticMessages, ...messages];
  
  const messagesWithUser = useMemo(() => {
    return allMessages.map((message) => {
      return {
        ...message,
        user: workspaceMembers[message.userId],
      } as MessageWithUser;
    });
  }, [allMessages, workspaceMembers]);

  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  };

  const handleScroll = () => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
        setShowScrollButton(!isNearBottom);
      }
    }
  };

  // Setup scroll event listener
  useEffect(() => {
    const scrollContainer = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
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

    setOptimisticMessages(prev => [optimisticMessage, ...prev]);

    try {
      await onSendMessage(content);
      setOptimisticMessages(prev => prev.filter(msg => msg.id !== optimisticMessage.id));
    } catch (error) {
      setOptimisticMessages(prev => prev.filter(msg => msg.id !== optimisticMessage.id));
      toast({
        title: "Error sending message",
        description: "Your message could not be sent. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="relative flex-1 flex flex-col h-full overflow-hidden">
      <ScrollArea ref={scrollAreaRef} className='flex-1'>
        <div className="p-4">
          <MessageList messages={messagesWithUser} />
        </div>
      </ScrollArea>
      <Button
        variant="secondary"
        size="icon"
        className={cn(
          'absolute bottom-40 right-4 rounded-full shadow-md transition-opacity z-10',
          showScrollButton ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={scrollToBottom}
      >
        <ChevronDown className="h-4 w-4" />
      </Button>
      <div className='border-t p-4 bg-background'>
        <MessageInput onSend={handleSendMessage} />
      </div>
    </div>
  );
};

export default MessageView;
