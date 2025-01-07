'use client';

import { type Message } from '@prisma/client';
import MessageList from './message-list';
import MessageInput from './message-input';
import { ScrollArea } from '../ui/scroll-area';
import { User } from '@/types/user';
import { useMemo, useState, useRef, useEffect } from 'react';
import { useWorkspace } from '@/contexts/workspace-context';
import { Button } from '../ui/button';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MessageWithUser extends Message {
  user: User;
}

interface MessageViewProps {
  messages: Message[];
  onSendMessage: (content: string) => Promise<Message | null>;
}

/** Displays a list of messages and allows for sending new messages. Does not handle backend logic. */
const MessageView = (props: MessageViewProps) => {
  const workspace = useWorkspace();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);

  // Map messages to include user info
  const messagesWithUser = useMemo(() => {
    return props.messages.map((message) => {
      return {
        ...message,
        user: workspace.members[message.userId],
      } as MessageWithUser;
    });
  }, [props.messages, workspace.members]);

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
        <MessageInput onSend={props.onSendMessage} />
      </div>
    </div>
  );
};

export default MessageView;
