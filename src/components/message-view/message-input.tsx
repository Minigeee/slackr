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
} from 'lucide-react';
import { useCallback } from 'react';

interface MessageInputProps {
  onSend: (content: string) => void;
}

const MessageInput = ({ onSend }: MessageInputProps) => {

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
    onSend(content);
    editor?.commands.clearContent();
  }, [editor, onSend]);

  return (
    <div className='rounded-lg border bg-white'>
      <div className='flex gap-1 border-b px-1 py-1'>
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
  );
};

export default MessageInput;
