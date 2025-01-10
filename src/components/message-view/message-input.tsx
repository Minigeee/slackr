import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Strike from '@tiptap/extension-strike';
import { Button } from '../ui/button';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  Send,
  X,
  Paperclip,
  Image as ImageIcon,
  File,
  Smile,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Separator } from '../ui/separator';
import { type MessageWithUser } from '@/types/message';
import { cn } from '@/lib/utils';
import { Emojis, getIsEmojiSuggesterOpen } from './emoji-extension';
import { EmojiPicker } from '../emoji-picker';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { type EmojiData } from '@emoji-mart/data';
import { useChannel } from '@/contexts/channel-context';

interface PendingAttachment {
  id: string;
  file: File;
  previewUrl?: string;
}

interface MessageInputProps {
  /** Callback to send the message */
  onSend: (content: string, attachments: File[], threadId?: string) => void;
  /** Thread id to send message in */
  threadId?: string;
  /** Message to reply to */
  replyTo?: MessageWithUser;
  /** Callback to cancel replying */
  onCancelReply?: () => void;
}

const MessageInput = ({ onSend, threadId, replyTo, onCancelReply }: MessageInputProps) => {
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const { typingUsers, startTyping, stopTyping } = useChannel();
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  const editor = useEditor({
    extensions: [StarterKit, Underline, Strike, Emojis],
    content: '',
    editorProps: {
      attributes: {
        class:
          'prose prose-sm focus:outline-none px-4 py-3 overflow-hidden break-all break-words max-w-full whitespace-pre-wrap w-full',
      },
      handleKeyDown: (view, event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
          // Don't submit if emoji suggester is open
          if (getIsEmojiSuggesterOpen()) {
            return false;
          }
          
          // Check if cursor is in a list - if so, allow default behavior
          if (editor?.isActive('bulletList') || editor?.isActive('orderedList')) {
            return false;
          }
          event.preventDefault();
          handleSend();
          return true;
        }

        // Handle typing indicator
        if (event.key.length === 1 || event.key === 'Backspace' || event.key === 'Delete') {
          handleTyping();
        }
      },
    },
    immediatelyRender: false,
  });

  const handleTyping = useCallback(() => {
    startTyping();
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to stop typing after 2 seconds
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 2000);
  }, [startTyping, stopTyping]);

  // Cleanup typing timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        stopTyping();
      }
    };
  }, [stopTyping]);

  // Format typing indicator text
  const typingText = useMemo(() => {
    if (typingUsers.length === 0) return null;
    
    const names = typingUsers.map(u => u.name);
    if (names.length === 1) {
      return `${names[0]} is typing...`;
    } else if (names.length === 2) {
      return `${names[0]} and ${names[1]} are typing...`;
    } else if (names.length === 3) {
      return `${names[0]}, ${names[1]}, and ${names[2]} are typing...`;
    } else {
      return `${names[0]}, ${names[1]}, and ${names.length - 2} others are typing...`;
    }
  }, [typingUsers]);

  const handleSend = useCallback(() => {
    if (editor?.isEmpty && pendingAttachments.length === 0) return;
    const content = editor?.getHTML() ?? '';
    onSend(content, pendingAttachments.map(a => a.file), threadId ?? replyTo?.id);
    editor?.commands.clearContent();
    setPendingAttachments([]);
  }, [editor, onSend, replyTo, threadId, pendingAttachments]);

  const handleEmojiSelect = useCallback((emoji: EmojiData) => {
    if (!editor) return;
    
    // Insert emoji at current cursor position
    editor
      .chain()
      .focus()
      .insertContent([
        {
          type: 'emojis',
          attrs: {
            'emoji-id': emoji.id,
          },
        },
        {
          type: 'text',
          text: ' ',
        },
      ])
      .run();

    setIsEmojiPickerOpen(false);
  }, [editor]);

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    // Limit to 10 files total
    const remainingSlots = 10 - pendingAttachments.length;
    const newFiles = files.slice(0, remainingSlots);

    const newAttachments = newFiles.map(file => {
      const attachment: PendingAttachment = {
        id: Math.random().toString(36).substring(7),
        file,
      };

      // Generate preview URL for images
      if (file.type.startsWith('image/')) {
        attachment.previewUrl = URL.createObjectURL(file);
      }

      return attachment;
    });

    setPendingAttachments(prev => [...prev, ...newAttachments]);
    
    // Reset input
    event.target.value = '';
  }, [pendingAttachments]);

  const removeAttachment = useCallback((id: string) => {
    setPendingAttachments(prev => {
      const newAttachments = prev.filter(a => a.id !== id);
      // Cleanup preview URLs
      prev.forEach(a => {
        if (a.id === id && a.previewUrl) {
          URL.revokeObjectURL(a.previewUrl);
        }
      });
      return newAttachments;
    });
  }, []);

  // Cleanup preview URLs on unmount
  useEffect(() => {
    return () => {
      pendingAttachments.forEach(a => {
        if (a.previewUrl) {
          URL.revokeObjectURL(a.previewUrl);
        }
      });
    };
  }, []);

  // Focus the editor when a reply is set
  useEffect(() => {
    if (replyTo) {
      editor?.commands.focus('end');
    }
  }, [replyTo]);

  return (
    <div className='flex flex-col gap-2'>
      {replyTo && (
        <div className='flex items-center gap-2 rounded-lg border bg-muted/50 px-4 py-2'>
          <div className='flex-1'>
            <div className='text-xs text-muted-foreground'>
              Replying to {replyTo.user?.firstName ?? replyTo.user?.email}
            </div>
            <div className='line-clamp-1 text-sm' dangerouslySetInnerHTML={{ __html: replyTo.content }} />
          </div>
          <Button variant='ghost' size='sm' onClick={onCancelReply}>
            <X className='h-4 w-4' />
          </Button>
        </div>
      )}

      <div className='relative'>
        {typingUsers.length > 0 && (
          <div className="absolute -top-6 left-0 z-10 rounded-sm bg-background/80 px-2 py-1 text-xs text-muted-foreground shadow-sm ring-1 ring-border animate-pulse">
            <span className='animate-pulse'>{typingText}</span>
          </div>
        )}

        {pendingAttachments.length > 0 && (
          <div className='flex gap-2 overflow-x-auto px-4 py-2'>
            {pendingAttachments.map((attachment) => (
              <div
                key={attachment.id}
                className='relative flex h-20 w-20 shrink-0 items-center justify-center rounded-lg border bg-muted'
              >
                {attachment.previewUrl ? (
                  <img
                    src={attachment.previewUrl}
                    alt={attachment.file.name}
                    className='h-full w-full rounded-lg object-cover'
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center gap-1" title={attachment.file.name}>
                    <File className='h-8 w-8 text-muted-foreground' />
                    <div className="text-xs text-muted-foreground truncate max-w-[72px] px-1">
                      {attachment.file.name}
                    </div>
                  </div>
                )}
                <Button
                  variant='secondary'
                  size='icon'
                  className='absolute -right-2 -top-2 h-6 w-6 rounded-full'
                  onClick={() => removeAttachment(attachment.id)}
                >
                  <X className='h-3 w-3' />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

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

          <Separator orientation='vertical' className='h-8' />

          <Popover open={isEmojiPickerOpen} onOpenChange={setIsEmojiPickerOpen}>
            <PopoverTrigger asChild>
              <Button
                variant='ghost'
                size='sm'
                className={isEmojiPickerOpen ? 'bg-muted' : ''}
              >
                <Smile className='h-4 w-4' />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              side="top"
              align="start"
              className="w-full p-4"
            >
              <EmojiPicker onSelect={handleEmojiSelect} />
            </PopoverContent>
          </Popover>

          <Button
            variant='ghost'
            size='sm'
            onClick={() => fileInputRef.current?.click()}
            className={cn(pendingAttachments.length >= 10 && 'opacity-50')}
            disabled={pendingAttachments.length >= 10}
          >
            <Paperclip className='h-4 w-4' />
          </Button>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelect}
            className="hidden"
            accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt"
            disabled={pendingAttachments.length >= 10}
          />

          <div className='flex-1' />

          <Button 
            onClick={handleSend}
            size='sm'
            disabled={editor?.isEmpty && pendingAttachments.length === 0}
          >
            <Send className='h-4 w-4' />
          </Button>
        </div>
        <EditorContent 
          editor={editor}
          className='min-h-[3rem]'
        />
      </div>
    </div>
  );
};

export default MessageInput;
