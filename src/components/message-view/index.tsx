'use client';

import { cn } from '@/lib/utils';
import { FullMessage, MessageWithUser } from '@/types/message';
import { type Message } from '@prisma/client';
import { ChevronDown } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import MessageInput from './message-input';
import MessageList from './message-list';

interface MessageViewProps {
  messages: FullMessage[];
  onSendMessage: (
    content: string,
    attachments: File[],
    threadId?: string,
  ) => Promise<Message | null>;
  threadId?: string; // If provided, shows only messages in this thread
}

/** Displays a list of messages and allows for sending new messages. Does not handle backend logic. */
const MessageView = (props: MessageViewProps) => {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [replyTo, setReplyTo] = useState<MessageWithUser | undefined>();

  // In thread view, show only messages in the thread
  const filteredMessages = useMemo(() => {
    return props.messages.filter((msg) => {
      if (props.threadId) {
        return msg.threadId === props.threadId;
      }
      return !msg.threadId;
    });
  }, [props.messages, props.threadId]);

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
  }, [props.messages.length]);

  const handleSendMessage = useCallback(
    async (content: string, attachments: File[], threadId?: string) => {
      setReplyTo(undefined);
      const message = await props
        .onSendMessage(content, attachments, threadId)
        .catch(() => {
          // If the message fails to send, revert the reply
          setReplyTo(replyTo);
        });
      return message;
    },
    [props.onSendMessage, replyTo],
  );

  return (
    <div className='relative flex h-full flex-1 flex-col overflow-hidden'>
      <ScrollArea ref={scrollAreaRef} className='flex-1'>
        <div className='p-4'>
          <MessageList
            messages={filteredMessages}
            onReply={props.threadId ? undefined : setReplyTo}
          />
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
        <MessageInput
          onSend={handleSendMessage}
          replyTo={replyTo}
          threadId={props.threadId}
          onCancelReply={() => setReplyTo(undefined)}
        />
      </div>
    </div>
  );
};

export default MessageView;
