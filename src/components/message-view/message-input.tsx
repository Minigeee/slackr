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
} from 'lucide-react';
import { useCallback, useEffect } from 'react';
import { Separator } from '../ui/separator';
import { type MessageWithUser } from '@/types/message';

interface MessageInputProps {
  /** Callback to send the message */
  onSend: (content: string, threadId?: string) => void;
  /** Thread id to send message in */
  threadId?: string;
  /** Message to reply to */
  replyTo?: MessageWithUser;
  /** Callback to cancel replying */
  onCancelReply?: () => void;
}

const MessageInput = ({ onSend, threadId, replyTo, onCancelReply }: MessageInputProps) => {

  const editor = useEditor({
    extensions: [StarterKit, Underline, Strike],
    content: '',
    editorProps: {
      attributes: {
        class:
          'prose prose-sm focus:outline-none px-4 py-3 overflow-hidden break-all break-words max-w-full whitespace-pre-wrap w-full',
      },
      handleKeyDown: (view, event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
          // Check if cursor is in a list - if so, allow default behavior
          if (editor?.isActive('bulletList') || editor?.isActive('orderedList')) {
            return false;
          }
          event.preventDefault();
          handleSend();
          return true;
        }
      },
    },
    immediatelyRender: false,
  });
  
  const handleSend = useCallback(() => {
    if (editor?.isEmpty) return;
    const content = editor?.getHTML() ?? '';
    onSend(content, threadId ?? replyTo?.id);
    editor?.commands.clearContent();
  }, [editor, onSend, replyTo, threadId]);

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

          <div className='flex-1' />

          <Button onClick={handleSend} size='sm'>
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
