import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { useChannel } from '@/contexts/channel-context';
import { api } from '@/trpc/react';
import { FullMessage } from '@/types/message';
import { useUser } from '@clerk/nextjs';
import {
  Copy,
  MessageSquare,
  Pencil,
  PinIcon,
  PinOffIcon,
  ReplyIcon,
  Smile,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { EmojiPicker } from '../emoji-picker';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
  DefaultAlertDialogFooter,
} from '../ui/alert-dialog';

interface MessageContextMenuProps {
  message: FullMessage;
  children: React.ReactNode;
  onReply?: (message: FullMessage) => void;
  onEdit?: (edit: boolean) => void;
}

export const MessageContextMenu = ({
  message,
  children,
  onReply,
  onEdit,
}: MessageContextMenuProps) => {
  const { setActiveThreadId, toggleReaction } = useChannel();
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isPinned, setIsPinned] = useState(!!message.pinnedAt);
  const { user } = useUser();
  const utils = api.useContext();

  const { mutateAsync: deleteMessage } = api.message.delete.useMutation({
    onSuccess: async () => {
      await utils.message.getAll.invalidate();
    },
  });

  const { mutateAsync: togglePin } = api.message.togglePin.useMutation({
    onSuccess: async () => {
      await utils.message.getAll.invalidate();
      await utils.message.getPinned.invalidate();
    },
    onError: () => {
      // Revert optimistic update on error
      setIsPinned(!!message.pinnedAt);
    },
  });

  const handleCopy = () => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = message.content;
    navigator.clipboard
      .writeText(tempDiv.textContent ?? '')
      .catch(console.error);
  };

  const handleDelete = async () => {
    try {
      await deleteMessage({ messageId: message.id });
    } catch (error) {
      console.error('Failed to delete message:', error);
    }
  };

  const handleViewThread = () => {
    setActiveThreadId(message.id);
  };

  const handleReply = () => {
    onReply?.(message);
  };

  const handleEmojiSelect = async (emoji: { id: string }) => {
    setIsEmojiPickerOpen(false);
    await toggleReaction(message.id, emoji.id);
  };

  const handleTogglePin = async () => {
    try {
      // Optimistic update
      setIsPinned(!isPinned);
      await togglePin({ messageId: message.id });
    } catch (error) {
      console.error('Failed to toggle pin:', error);
    }
  };

  const isAuthor = user?.id === message.userId;

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
        <ContextMenuContent className='w-52'>
          <ContextMenuItem onSelect={handleCopy}>
            <Copy className='mr-2 h-4 w-4' />
            Copy
          </ContextMenuItem>
          {message.replies?.length && (
            <ContextMenuItem onSelect={handleViewThread}>
              <MessageSquare className='mr-2 h-4 w-4' />
              View thread
            </ContextMenuItem>
          )}
          {!message.threadId && (
            <ContextMenuItem onSelect={handleReply}>
              <ReplyIcon className='mr-2 h-4 w-4' />
              Reply
            </ContextMenuItem>
          )}
          <ContextMenuSub
            open={isEmojiPickerOpen}
            onOpenChange={setIsEmojiPickerOpen}
          >
            <ContextMenuSubTrigger>
              <Smile className='mr-2 h-4 w-4' />
              Add reaction
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className='p-4'>
              <EmojiPicker onSelect={handleEmojiSelect} />
            </ContextMenuSubContent>
          </ContextMenuSub>
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={handleTogglePin}>
            {isPinned ? (
              <PinOffIcon className='mr-2 h-4 w-4' />
            ) : (
              <PinIcon className='mr-2 h-4 w-4' />
            )}
            {isPinned ? 'Unpin' : 'Pin'}
          </ContextMenuItem>
          {isAuthor && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem onSelect={() => onEdit?.(true)}>
                <Pencil className='mr-2 h-4 w-4' />
                Edit
              </ContextMenuItem>
              <ContextMenuItem
                onSelect={() => setIsDeleteDialogOpen(true)}
                className='text-red-600'
              >
                <Trash2 className='mr-2 h-4 w-4' />
                Delete
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>

      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Message</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this message? This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <DefaultAlertDialogFooter
            actionLabel='Delete'
            actionVariant='destructive'
            onAction={handleDelete}
            onOpenChange={setIsDeleteDialogOpen}
          />
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
