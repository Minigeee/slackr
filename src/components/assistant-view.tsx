'use client';

import { cn } from '@/lib/utils';
import { api } from '@/trpc/react';
import { Bot, PlusIcon, X } from 'lucide-react';
import Markdown from 'markdown-to-jsx';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';
import { Textarea } from './ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';

/* TEMP : Convo RAG data
const data = [
  {
    id: 'vec1',
    text: 'Apple is a popular fruit known for its sweetness and crisp texture.',
  },
  {
    id: 'vec2',
    text: 'The tech company Apple is known for its innovative products like the iPhone.',
  },
  { id: 'vec3', text: 'Many people enjoy eating apples as a healthy snack.' },
  {
    id: 'vec4',
    text: 'Apple Inc. has revolutionized the tech industry with its sleek designs and user-friendly interfaces.',
  },
  {
    id: 'vec5',
    text: 'An apple a day keeps the doctor away, as the saying goes.',
  },
  {
    id: 'vec6',
    text: 'Apple Computer Company was founded on April 1, 1976, by Steve Jobs, Steve Wozniak, and Ronald Wayne as a partnership.',
  },
]; */

type AIChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type Conversation = {
  id: string;
  messages: AIChatMessage[];
};

export default function AssistantView() {
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const [conversations, setConversations] = useState<Conversation[]>([
    { id: '1', messages: [] },
  ]);
  const [activeTab, setActiveTab] = useState('1');
  const [input, setInput] = useState('');
  const [convId, setConvId] = useState(1);

  const chatMutation = api.chat.chat.useMutation({
    onSuccess: (data) => {
      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === activeTab
            ? {
                ...conv,
                messages: [
                  ...conv.messages,
                  { role: 'assistant', content: data.content },
                ],
              }
            : conv,
        ),
      );
    },
  });

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!input.trim()) return;

      const userMessage = { role: 'user' as const, content: input.trim() };
      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === activeTab
            ? {
                ...conv,
                messages: [...conv.messages, userMessage],
              }
            : conv,
        ),
      );
      setInput('');

      const activeConversation = conversations.find((c) => c.id === activeTab);
      if (!activeConversation) return;

      await chatMutation.mutate({
        message: userMessage.content,
        conversationHistory: activeConversation.messages,
      });
    },
    [conversations, activeTab, chatMutation],
  );

  const addNewChat = useCallback(() => {
    const newId = (convId + 1).toString();
    setConversations((prev) => [...prev, { id: newId, messages: [] }]);
    setActiveTab(newId);
    setConvId(convId + 1);
  }, [conversations, convId]);

  const closeChat = useCallback(
    (id: string) => {
      if (conversations.length === 1) return; // Don't remove last tab

      const newConversations = conversations.filter((conv) => conv.id !== id);
      setConversations(newConversations);

      if (activeTab === id) {
        setActiveTab(newConversations[0]?.id || '1');
      }
    },
    [conversations, activeTab],
  );

  // Scroll to bottom when the conversation changes
  const scrollToBottom = useCallback(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector(
        '[data-radix-scroll-area-viewport]',
      );
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [scrollAreaRef]);
  useEffect(() => {
    scrollToBottom();
  }, [conversations, activeTab]);

  // Get the current conversation
  const conv = useMemo(() => {
    return conversations.find((c) => c.id === activeTab);
  }, [conversations, activeTab]);

  // Render messages
  const messages = useMemo(() => {
    return conv?.messages.map((message) => (
      <Markdown
        className={cn(
          'prose',
          message.role === 'user' && 'text-primary-foreground',
        )}
      >
        {message.content}
      </Markdown>
    ));
  }, [conv]);

  return (
    <div className='flex flex-col h-full'>
      {/* Header */}
      <div className='p-4 border-b flex items-center gap-3 shrink-0'>
        <Avatar className='h-10 w-10'>
          <AvatarImage src='/slacker-supreme.png' />
          <AvatarFallback>
            <Bot className='h-6 w-6' />
          </AvatarFallback>
        </Avatar>
        <div>
          <h3 className='font-semibold'>Slacker Supreme</h3>
          <p className='text-sm text-muted-foreground'>
            Slackr AI • Maximum Output Minimizer
          </p>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className='flex-1 flex flex-col min-h-0'
      >
        <div className='px-2 pt-2 shrink-0'>
          <TabsList className='w-full justify-start'>
            {conversations.map((conv) => (
              <TabsTrigger
                key={conv.id}
                value={conv.id}
                className={cn(
                  'relative gap-2 data-[state=active]:bg-primary/10',
                  conversations.length > 1 && 'pr-1.5',
                )}
              >
                Chat {conv.id}
                {conversations.length > 1 && (
                  <Button
                    variant='ghost'
                    size='icon'
                    onClick={(e) => {
                      e.stopPropagation();
                      closeChat(conv.id);
                    }}
                    className='w-5 h-5 rounded-sm'
                  >
                    <X className='h- w-3' />
                  </Button>
                )}
              </TabsTrigger>
            ))}
            <Button
              variant='ghost'
              size='icon'
              onClick={addNewChat}
              className='w-9 h-9 ml-1'
            >
              <PlusIcon className='h-4 w-4' />
            </Button>
          </TabsList>
        </div>

        <div className='flex-1 flex flex-col p-4 min-h-0'>
          <ScrollArea 
            ref={scrollAreaRef} 
            className='flex-1 pr-4 min-h-0'
            viewportClassName='min-h-0'
          >
            <div className='space-y-4 pb-4'>
              {messages &&
                conv?.messages.map((message, i) => (
                  <div
                    key={i}
                    className={cn('flex items-end gap-2', 
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    )}
                  >
                    {message.role === 'assistant' && (
                      <Avatar className='h-6 w-6'>
                        <AvatarImage src='/slacker-supreme.png' />
                        <AvatarFallback>
                          <Bot className='h-4 w-4' />
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div
                      className={cn(
                        'max-w-[80%] rounded-2xl px-4 py-2',
                        message.role === 'user'
                          ? 'bg-primary text-primary-foreground rounded-br-sm'
                          : 'bg-muted rounded-bl-sm'
                      )}
                    >
                      {messages[i]}
                    </div>
                  </div>
                ))}
              {chatMutation.isPending && conv?.id === activeTab && (
                <div className='flex items-end gap-2'>
                  <Avatar className='h-6 w-6'>
                    <AvatarImage src='/slacker-supreme.png' />
                    <AvatarFallback>
                      <Bot className='h-4 w-4' />
                    </AvatarFallback>
                  </Avatar>
                  <div className='max-w-[80%] rounded-2xl rounded-bl-sm bg-muted px-4 py-2'>
                    <div className='flex gap-1'>
                      <span className='w-2 h-2 rounded-full bg-foreground/30 animate-bounce' style={{ animationDelay: '0ms' }} />
                      <span className='w-2 h-2 rounded-full bg-foreground/30 animate-bounce' style={{ animationDelay: '150ms' }} />
                      <span className='w-2 h-2 rounded-full bg-foreground/30 animate-bounce' style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <form onSubmit={handleSubmit} className='mt-4 shrink-0'>
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder='Message Slacker Supreme...'
              className='resize-none rounded-xl'
              rows={3}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
            />
          </form>
        </div>
      </Tabs>
    </div>
  );
}
