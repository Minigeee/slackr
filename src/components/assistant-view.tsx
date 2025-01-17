'use client';

import { useWorkspace } from '@/contexts/workspace-context';
import { cn } from '@/lib/utils';
import { api } from '@/trpc/react';
import { EVENTS, getStreamChannelName, pusherClient } from '@/utils/pusher';
import { Bot, PlusIcon, X } from 'lucide-react';
import Markdown from 'markdown-to-jsx';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';
import { Textarea } from './ui/textarea';

type AIChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type Conversation = {
  id: string;
  messages: AIChatMessage[];
  streamId?: string;
  isStreaming?: boolean;
  currentAction?: string;
};

// Helper to clean action lines from response
function cleanResponse(content: string) {
  return content
    .split('\n')
    .filter((line) => !line.trim().startsWith('[[Action]]'))
    .join('\n')
    .trim();
}

// Helper to extract current action from response
function extractAction(content: string): string | undefined {
  const actionMatch = content.match(/\[\[Action\]\]\s*(\{.*?\})/);
  if (actionMatch?.[1]) {
    try {
      const action = JSON.parse(actionMatch[1]) as {
        type: string;
        in?: string;
        search?: string;
      };
      switch (action.type) {
        case 'query-messages':
          if (action.in) {
            return `Checking messages from ${action.in.startsWith('#') ? action.in : `#${action.in}`}...`;
          }
          break;
        case 'query-channels':
          return action.search
            ? `Searching for channels matching "${action.search}"...`
            : 'Listing available channels...';
        case 'query-users':
          return action.search
            ? `Searching for users matching "${action.search}"...`
            : 'Listing workspace members...';
      }
      return `Performing ${action.type}...`;
    } catch (e) {
      return undefined;
    }
  }
  return undefined;
}

// Add command definitions
type SlashCommand = {
  command: string;
  description: string;
  transform: (args: string) => string;
};

const SLASH_COMMANDS: SlashCommand[] = [
  {
    command: '/brief',
    description: 'Get a detailed briefing of recent channel activity',
    transform: (channel: string) =>
      `Summarize the latest messages and developments in #${channel.trim()} in the form of a briefing using a message query. Focus on key points and discussions.`,
  },
  {
    command: '/tldr',
    description: 'Get a quick summary of channel activity',
    transform: (channel: string) =>
      `Give me a one or two sentence TLDR summary of the latest messages in #${channel.trim()} using a message query.`,
  },
  {
    command: '/explain',
    description: 'Simplify technical discussions into plain language',
    transform: (channel: string) =>
      `Analyze the technical discussions in #${channel.trim()} using a message query and explain them in simple, plain language that anyone can understand.`,
  },
];

// Add command parsing helper
function parseSlashCommand(
  input: string,
): { command: SlashCommand; args: string } | null {
  const trimmed = input.trim();
  if (!trimmed.startsWith('/')) return null;

  const [commandStr, ...args] = trimmed.split(' ');
  const command = SLASH_COMMANDS.find((cmd) => cmd.command === commandStr);

  if (!command) return null;

  return {
    command,
    args: args.join(' '),
  };
}

/** Hold conversation state in memory to avoid reseting on mount */
const _convCache: Record<string, Conversation[]> = {};

export default function AssistantView() {
  const { workspace } = useWorkspace();
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const [conversations, setConversations] = useState<Conversation[]>(
    _convCache[workspace?.id ?? ''] || [{ id: '1', messages: [] }],
  );
  const [activeTab, setActiveTab] = useState('1');
  const [input, setInput] = useState('');
  const [convId, setConvId] = useState(1);

  // Cache conversation state in memory
  useEffect(() => {
    _convCache[workspace?.id ?? ''] = conversations;
  }, [conversations]);

  const cleanupPusherSubscription = useCallback((streamId: string) => {
    const channelName = getStreamChannelName(streamId);
    const channel = pusherClient.channel(channelName);
    if (channel) {
      channel.unbind_all();
      pusherClient.unsubscribe(channelName);
    }
  }, []);

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
                streamId: data.streamId,
                isStreaming: !!data.streamId,
                currentAction: extractAction(data.content),
              }
            : conv,
        ),
      );

      if (data.streamId) {
        const { streamId } = data;
        const channelName = getStreamChannelName(streamId);
        const channel = pusherClient.subscribe(channelName);

        channel.bind(
          EVENTS.STREAM_RESPONSE,
          (data: { content: string; finished: boolean }) => {
            setConversations((prev) =>
              prev.map((conv) =>
                conv.id === activeTab
                  ? {
                      ...conv,
                      messages: [
                        ...conv.messages,
                        { role: 'assistant', content: data.content },
                      ],
                      isStreaming: !data.finished,
                      currentAction: !data.finished
                        ? extractAction(data.content)
                        : undefined,
                    }
                  : conv,
              ),
            );

            if (data.finished) {
              channel.unbind(EVENTS.STREAM_RESPONSE);
              cleanupPusherSubscription(streamId);
            }
          },
        );
      }
    },
    onError: (error) => {
      console.error('Chat error:', error);
      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === activeTab
            ? {
                ...conv,
                isStreaming: false,
                currentAction: undefined,
              }
            : conv,
        ),
      );
    },
  });

  // Cleanup pusher subscriptions when the component unmounts
  useEffect(() => {
    return () => {
      conversations.forEach((conv) => {
        if (conv.streamId) {
          cleanupPusherSubscription(conv.streamId);
        }
      });
    };
  }, [conversations]);

  // Cleanup pusher subscriptions when the active tab changes
  useEffect(() => {
    const prevConv = conversations.find(
      (c) => c.id !== activeTab && c.streamId,
    );
    if (prevConv?.streamId) {
      cleanupPusherSubscription(prevConv.streamId);
    }
  }, [activeTab]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!input.trim()) return;

      // Process slash commands
      const parsedCommand = parseSlashCommand(input);
      const messageContent = parsedCommand
        ? parsedCommand.command.transform(parsedCommand.args)
        : input.trim();

      const userMessage = { role: 'user' as const, content: messageContent };
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
    [conversations, activeTab, chatMutation, input],
  );

  // Add command detection for input styling
  const isCommand = useMemo(() => {
    return parseSlashCommand(input) !== null;
  }, [input]);

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
        {cleanResponse(message.content)}
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
                    className={cn(
                      'flex items-end gap-2',
                      message.role === 'user' ? 'justify-end' : 'justify-start',
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
                          : 'bg-muted rounded-bl-sm',
                      )}
                    >
                      {messages[i]}
                    </div>
                  </div>
                ))}
              {(chatMutation.isPending || conv?.isStreaming) &&
                conv?.id === activeTab && (
                  <div className='flex items-end gap-2'>
                    <Avatar className='h-6 w-6'>
                      <AvatarImage src='/slacker-supreme.png' />
                      <AvatarFallback>
                        <Bot className='h-4 w-4' />
                      </AvatarFallback>
                    </Avatar>
                    <div className='max-w-[80%] rounded-2xl rounded-bl-sm bg-muted px-4 py-2'>
                      <div className='flex flex-col gap-2'>
                        {conv?.currentAction && (
                          <p className='text-sm text-muted-foreground'>
                            {conv.currentAction}
                          </p>
                        )}
                        <div className='flex gap-1'>
                          <span
                            className='w-2 h-2 rounded-full bg-foreground/30 animate-bounce'
                            style={{ animationDelay: '0ms' }}
                          />
                          <span
                            className='w-2 h-2 rounded-full bg-foreground/30 animate-bounce'
                            style={{ animationDelay: '150ms' }}
                          />
                          <span
                            className='w-2 h-2 rounded-full bg-foreground/30 animate-bounce'
                            style={{ animationDelay: '300ms' }}
                          />
                        </div>
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
              placeholder='Message Slacker Supreme... (Try /brief, /tldr, /explain)'
              className={cn(
                'resize-none rounded-xl',
                isCommand && 'text-primary font-medium',
              )}
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
