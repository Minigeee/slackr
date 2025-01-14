import { api } from '@/trpc/react';
import { PlusIcon, X } from 'lucide-react';
import { PropsWithChildren, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
import { ScrollArea } from './ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';
import { Textarea } from './ui/textarea';
import Markdown from 'markdown-to-jsx';
import { cn } from '@/lib/utils';

type AIChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type Conversation = {
  id: string;
  messages: AIChatMessage[];
};

interface AssistantDialogProps extends PropsWithChildren {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AssistantDialog({
  open,
  onOpenChange,
  children,
}: AssistantDialogProps) {
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
    const newId = convId.toString();
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
      <Markdown className={cn('prose', message.role === 'user' && 'text-primary-foreground')}>{message.content}</Markdown>
    ));
  }, [conv]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>

      <DialogContent className='max-w-2xl'>
        <DialogHeader>
          <DialogTitle>Chat with <em>The Slacker</em></DialogTitle>
          <DialogDescription>
            Your personal AI assistant.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className='flex-1'>
          <div className='flex items-center gap-2'>
            <TabsList>
              {conversations.map((conv) => (
                <TabsTrigger value={conv.id} className={cn('relative gap-2', conversations.length > 1 && 'pr-1.5')}>
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
                      <X className='h-4 w-4' />
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

          <div className='flex h-[60vh] flex-col gap-4 mt-2'>
            <ScrollArea ref={scrollAreaRef} className='flex-1 p-2'>
              <div className='space-y-4'>
                {messages && conv?.messages.map((message, i) => (
                  <div
                    key={i}
                    className={`flex ${
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg px-4 py-2 ${
                        message.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      {messages[i]}
                    </div>
                  </div>
                ))}
                {chatMutation.isPending && conv?.id === activeTab && (
                  <div className='flex justify-start'>
                    <div className='max-w-[80%] rounded-lg bg-muted px-4 py-2 animate-pulse'>
                      Thinking...
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            <form onSubmit={handleSubmit} className='flex gap-2'>
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder='Type your message...'
                className='flex-1 resize-none'
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
      </DialogContent>
    </Dialog>
  );
}
