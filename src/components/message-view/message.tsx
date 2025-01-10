import { useChannel } from '@/contexts/channel-context';
import { cn } from '@/lib/utils';
import { api } from '@/trpc/react';
import { AttachmentWithStatus, FullMessage } from '@/types/message';
import { useUser } from '@clerk/nextjs';
import Strike from '@tiptap/extension-strike';
import Underline from '@tiptap/extension-underline';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import dayjs from 'dayjs';
import {
  Bold,
  Download,
  ExternalLink,
  FileIcon,
  ImageIcon,
  Italic,
  List,
  ListOrdered,
  MessageSquare,
  PlusIcon,
  Strikethrough,
  Underline as UnderlineIcon,
} from 'lucide-react';
import { memo, useMemo, useState } from 'react';
import { Emoji } from '../emoji';
import { EmojiPicker } from '../emoji-picker';
import { AsyncButton } from '../ui/async-button';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Button } from '../ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Separator } from '../ui/separator';
import { Emojis } from './emoji-extension';
import { MessageContextMenu } from './message-context-menu';

interface MessageEditorProps {
  content: string;
  onSave: (content: string) => Promise<void>;
  onCancel: () => void;
}

const MessageEditor = ({ content, onSave, onCancel }: MessageEditorProps) => {
  const editor = useEditor({
    extensions: [StarterKit, Underline, Strike, Emojis],
    content,
    editorProps: {
      attributes: {
        class:
          'prose prose-sm focus:outline-none px-4 py-3 overflow-hidden break-all break-words max-w-full whitespace-pre-wrap w-full',
      },
    },
  });

  const handleSave = async () => {
    if (editor?.isEmpty) return;
    const content = editor?.getHTML() ?? '';
    await onSave(content);
  };

  return (
    <div className='mt-2'>
      <div className='rounded-lg border bg-white'>
        <div className='flex items-center gap-1 border-b px-1 py-1'>
          <Button
            variant='ghost'
            size='sm'
            onClick={() => editor?.chain().focus().toggleBold().run()}
            className={editor?.isActive('bold') ? 'bg-muted' : ''}
          >
            <Bold className='h-4 w-4' />
          </Button>
          <Button
            variant='ghost'
            size='sm'
            onClick={() => editor?.chain().focus().toggleItalic().run()}
            className={editor?.isActive('italic') ? 'bg-muted' : ''}
          >
            <Italic className='h-4 w-4' />
          </Button>
          <Button
            variant='ghost'
            size='sm'
            onClick={() => editor?.chain().focus().toggleUnderline().run()}
            className={editor?.isActive('underline') ? 'bg-muted' : ''}
          >
            <UnderlineIcon className='h-4 w-4' />
          </Button>
          <Button
            variant='ghost'
            size='sm'
            onClick={() => editor?.chain().focus().toggleStrike().run()}
            className={editor?.isActive('strike') ? 'bg-muted' : ''}
          >
            <Strikethrough className='h-4 w-4' />
          </Button>
          <Separator orientation='vertical' className='h-8' />
          <Button
            variant='ghost'
            size='sm'
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
            className={editor?.isActive('bulletList') ? 'bg-muted' : ''}
          >
            <List className='h-4 w-4' />
          </Button>
          <Button
            variant='ghost'
            size='sm'
            onClick={() => editor?.chain().focus().toggleOrderedList().run()}
            className={editor?.isActive('orderedList') ? 'bg-muted' : ''}
          >
            <ListOrdered className='h-4 w-4' />
          </Button>
        </div>
        <EditorContent editor={editor} className='min-h-[3rem]' />
      </div>
      <div className='mt-2 flex gap-2'>
        <AsyncButton size='sm' onClick={handleSave}>
          Save
        </AsyncButton>
        <Button size='sm' variant='outline' onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
};

type AttachmentPreviewProps = Omit<
  AttachmentWithStatus,
  'id' | 'createdAt' | 'messageId' | 'key'
>;

const AttachmentPreview = ({
  url,
  filename,
  mimeType,
  size,
  width,
  height,
  isUploading,
}: AttachmentPreviewProps) => {
  const isImage = mimeType.startsWith('image/');
  const formattedSize = useMemo(() => {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    let sizeInBytes = size;
    let sizeIndex = 0;
    while (sizeInBytes >= 1024 && sizeIndex < sizes.length - 1) {
      sizeInBytes /= 1024;
      sizeIndex++;
    }
    return `${Math.round(sizeInBytes * 10) / 10} ${sizes[sizeIndex]}`;
  }, [size]);

  if (isImage) {
    return (
      <div className='group relative inline-block max-w-xs overflow-hidden rounded-lg border'>
        {url ? (
          <>
            <img
              src={url}
              alt={filename}
              className='max-h-96 w-auto object-cover'
              style={{
                aspectRatio: width && height ? `${width}/${height}` : undefined,
              }}
            />
            <div className='absolute inset-0 flex items-center justify-center gap-2 bg-black/20 opacity-0 transition-opacity group-hover:opacity-100'>
              <Button
                size='sm'
                variant='secondary'
                onClick={() => window.open(url, '_blank')}
              >
                <ExternalLink className='h-4 w-4' />
              </Button>
              <Button
                size='sm'
                variant='secondary'
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = filename;
                  link.click();
                }}
              >
                <Download className='h-4 w-4' />
              </Button>
            </div>
          </>
        ) : (
          <div className='flex aspect-square w-64 items-center justify-center bg-muted/50'>
            <div className='flex flex-col items-center gap-2'>
              <ImageIcon className='h-8 w-8 animate-pulse text-muted-foreground' />
              <div className='text-sm text-muted-foreground'>
                Uploading image...
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className='flex items-center gap-2 rounded-lg border bg-muted/50 p-2'>
      <div className='flex h-10 w-10 shrink-0 items-center justify-center rounded bg-muted'>
        <FileIcon
          className={cn(
            'h-5 w-5 text-muted-foreground',
            isUploading && 'animate-pulse',
          )}
        />
      </div>
      <div className='min-w-0 flex-1'>
        <div className='truncate font-medium text-sm'>{filename}</div>
        <div className='text-xs text-muted-foreground'>
          {isUploading ? 'Uploading...' : formattedSize}
        </div>
      </div>
      {url && (
        <Button
          size='sm'
          variant='ghost'
          onClick={() => {
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            link.click();
          }}
        >
          <Download className='h-4 w-4' />
        </Button>
      )}
    </div>
  );
};

interface ReactionButtonProps {
  emoji: string;
  count: number;
  hasReacted: boolean;
  onToggle: () => void;
}

const ReactionButton = ({
  emoji,
  count,
  hasReacted,
  onToggle,
}: ReactionButtonProps) => {
  return (
    <Button
      variant='ghost'
      size='sm'
      onClick={onToggle}
      className={cn(
        'h-7 gap-1 rounded-full px-2 text-xs hover:bg-muted',
        hasReacted && 'bg-secondary',
      )}
    >
      <Emoji id={emoji} size='16px' />
      <span>{count}</span>
    </Button>
  );
};

interface MessageProps {
  message: FullMessage;
  onReply?: (message: FullMessage) => void;
}

const MessageNoMemo = ({ message, onReply }: MessageProps) => {
  const { user } = useUser();
  const { setActiveThreadId, toggleReaction } = useChannel();

  const [isEditing, setIsEditing] = useState(false);
  const utils = api.useContext();
  const { mutateAsync: updateMessage } = api.message.update.useMutation({
    onSuccess: async () => {
      await utils.message.getAll.invalidate();
      setIsEditing(false);
    },
  });

  const name = useMemo(() => {
    if (message.user?.firstName && message.user?.lastName) {
      return `${message.user.firstName} ${message.user.lastName}`;
    }
    return message.user?.email ?? 'Unknown User';
  }, [message.user?.firstName, message.user?.lastName, message.user?.email]);

  const initials = useMemo(() => {
    return name.slice(0, 2).toUpperCase();
  }, [name]);

  const handleSaveEdit = async (content: string) => {
    await updateMessage({ messageId: message.id, content });
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const threadInfo = useMemo(() => {
    if (!message.replies?.length) return null;

    const latestReply = message.replies[0];
    const replyCount = message.replies.length;

    return {
      count: replyCount,
      latestReply,
      timeString: latestReply ? dayjs(latestReply.createdAt).calendar() : '',
    };
  }, [message.replies]);

  // Group reactions by emoji
  const reactionGroups = useMemo(() => {
    const groups = new Map<string, { count: number; userIds: string[] }>();
    message.reactions?.forEach((reaction) => {
      const existing = groups.get(reaction.emoji) ?? { count: 0, userIds: [] };
      existing.count++;
      existing.userIds.push(reaction.userId);
      groups.set(reaction.emoji, existing);
    });
    return groups;
  }, [message.reactions]);

  const messageContent = (
    <div className='group flex gap-3 rounded-lg px-3 py-2 hover:bg-muted/50'>
      <Avatar>
        <AvatarImage src={message.user?.profilePicture ?? undefined} />
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>
      <div className='flex flex-1 flex-col'>
        <div className='flex items-center gap-2'>
          <span className='font-semibold'>{name}</span>
          <span className='text-xs text-muted-foreground'>
            {dayjs(message.createdAt).calendar()}
          </span>
        </div>
        {isEditing ? (
          <MessageEditor
            content={message.content}
            onSave={handleSaveEdit}
            onCancel={handleCancelEdit}
          />
        ) : (
          <>
            <div
              className={cn(
                'prose prose-sm w-full overflow-hidden break-words',
                'prose-p:my-0 prose-p:leading-snug',
                'prose-ol:my-1 prose-ul:my-1',
                'prose-li:my-0',
              )}
              dangerouslySetInnerHTML={{ __html: message.content }}
            />
            {message.attachments && message.attachments.length > 0 && (
              <div className='mt-2 flex flex-col gap-2'>
                {message.attachments.map((attachment) => (
                  <AttachmentPreview {...attachment} key={attachment.id} />
                ))}
              </div>
            )}
            {reactionGroups.size > 0 && (
              <div className='mt-1 flex flex-wrap items-center gap-1'>
                {Array.from(reactionGroups.entries()).map(
                  ([emoji, { count, userIds }]) => (
                    <ReactionButton
                      key={emoji}
                      emoji={emoji}
                      count={count}
                      hasReacted={userIds.includes(user?.id ?? '')}
                      onToggle={() => toggleReaction(message.id, emoji)}
                    />
                  ),
                )}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant='ghost'
                      size='icon'
                      className='h-6 w-6 rounded-full'
                    >
                      <PlusIcon className='h-4 w-4' />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    side='right'
                    align='end'
                    className='w-fit p-4'
                  >
                    <EmojiPicker
                      onSelect={(emoji) => toggleReaction(message.id, emoji.id)}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}
            {threadInfo && (
              <Button
                variant='ghost'
                size='sm'
                className='mt-1 flex w-fit items-center gap-1 rounded-md bg-muted border border-transparent text-xs hover:bg-muted hover:border-border'
                onClick={() => setActiveThreadId(message.id)}
              >
                <MessageSquare className='mr-1 h-3 w-3' />
                {threadInfo.count}{' '}
                {threadInfo.count === 1 ? 'reply' : 'replies'}
                <span className='mx-1'>·</span>
                Latest reply {threadInfo.timeString}
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );

  return (
    <MessageContextMenu
      message={message}
      onReply={onReply}
      onEdit={setIsEditing}
    >
      {messageContent}
    </MessageContextMenu>
  );
};

export const Message = memo(MessageNoMemo);
