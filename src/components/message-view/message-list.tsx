import { type Message } from '@prisma/client';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { cn } from '@/lib/utils';
import dayjs from 'dayjs';
import calendar from 'dayjs/plugin/calendar';
import { User } from '@/types/user';
import { memo, useMemo, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Strike from '@tiptap/extension-strike';
import { Button } from '../ui/button';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { api } from '@/trpc/react';
import { 
  Bold, 
  Italic, 
  Underline as UnderlineIcon, 
  Strikethrough, 
  List, 
  ListOrdered,
  Copy,
  Pencil,
  Trash2
} from 'lucide-react';
import { Separator } from '../ui/separator';
import { useUser } from '@clerk/nextjs';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  DefaultAlertDialogFooter,
} from '../ui/alert-dialog';
import { AsyncButton } from '../ui/async-button';

dayjs.extend(calendar);

interface MessageWithUser extends Message {
  user: User | undefined;
}

interface MessageEditorProps {
  content: string;
  onSave: (content: string) => Promise<void>;
  onCancel: () => void;
}

const MessageEditor = ({ content, onSave, onCancel }: MessageEditorProps) => {
  const editor = useEditor({
    extensions: [StarterKit, Underline, Strike],
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
      <div className='flex gap-2 mt-2'>
        <AsyncButton size='sm' onClick={handleSave}>Save</AsyncButton>
        <Button size='sm' variant='outline' onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
};

interface MessageProps {
  message: MessageWithUser;
}

const Message = ({ message }: MessageProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const { user } = useUser();
  const utils = api.useContext();
  const { mutateAsync: deleteMessage } = api.message.delete.useMutation({
    onSuccess: () => {
      utils.message.getAll.invalidate();
    },
  });
  const { mutateAsync: updateMessage } = api.message.update.useMutation({
    onSuccess: () => {
      utils.message.getAll.invalidate();
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

  const handleCopy = () => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = message.content;
    navigator.clipboard.writeText(tempDiv.textContent || '');
  };

  const handleDelete = async () => {
    await deleteMessage({ messageId: message.id });
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleSaveEdit = async (content: string) => {
    await updateMessage({ messageId: message.id, content });
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const isAuthor = user?.id === message.userId;

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger>
          <div className='group flex gap-3 hover:bg-muted/50 px-3 py-2 rounded-lg'>
            <Avatar>
              <AvatarImage src={message.user?.profilePicture ?? undefined} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className='flex flex-col flex-1'>
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
                <div
                  className={cn(
                    'prose prose-sm overflow-hidden break-words w-full',
                    'prose-p:my-0 prose-p:leading-snug',
                    'prose-ol:my-1 prose-ul:my-1',
                    'prose-li:my-0',
                  )}
                  dangerouslySetInnerHTML={{ __html: message.content }}
                />
              )}
            </div>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onSelect={handleCopy}>
            <Copy className="h-4 w-4 mr-2" />
            Copy
          </ContextMenuItem>
          {isAuthor && (
            <>
              <ContextMenuItem onSelect={handleEdit}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </ContextMenuItem>
              <ContextMenuItem 
                onSelect={() => setIsDeleteDialogOpen(true)} 
                className="text-red-600"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Message</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this message? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <DefaultAlertDialogFooter
            actionLabel="Delete"
            actionVariant="destructive"
            onAction={handleDelete}
            onOpenChange={setIsDeleteDialogOpen}
          />
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
const MemoMessage = memo(Message);

interface MessageListProps {
  messages: MessageWithUser[];
}

const MessageList = ({ messages }: MessageListProps) => {
  return (
    <div className='flex flex-col-reverse gap-4 overflow-y-auto p-4'>
      {messages.map((message) => (
        <MemoMessage key={message.id} message={message} />
      ))}
    </div>
  );
};

export default MessageList;
