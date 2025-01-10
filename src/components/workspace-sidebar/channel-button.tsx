import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
  DefaultAlertDialogFooter,
} from '@/components/ui/alert-dialog';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Input } from '@/components/ui/input';
import { useWorkspace } from '@/contexts/workspace-context';
import { api } from '@/trpc/react';
import { Channel, Workspace } from '@prisma/client';
import { Pencil, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface ChannelButtonProps {
  /** Channel */
  channel: Channel;
  /** Workspace */
  workspace: Workspace;
  /** Is channel selected */
  selected: boolean;
}

export function ChannelButton(props: ChannelButtonProps) {
  const router = useRouter();
  const { deleteChannel } = useWorkspace();

  const [isEditing, setIsEditing] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [channelName, setChannelName] = useState(props.channel.name);
  const utils = api.useContext();

  const { mutateAsync: updateChannel } = api.channel.update.useMutation({
    onSuccess: () => {
      utils.channel.getAll.invalidate();
    },
  });

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsEditing(false);
    await updateChannel({
      channelId: props.channel.id,
      name: channelName,
    });
  };

  const handleDelete = async () => {
    try {
      await deleteChannel(props.channel.id);
      setIsDeleteDialogOpen(false);
      router.push(`/w/${props.workspace.id}`);
    } catch (error) {
      console.error('Failed to delete channel:', error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsEditing(false);
      setChannelName(props.channel.name);
    }
  };

  if (isEditing) {
    return (
      <form onSubmit={handleRename} className='px-2'>
        <Input
          value={channelName}
          onChange={(e) => setChannelName(e.target.value)}
          onBlur={() => {
            setIsEditing(false);
            setChannelName(props.channel.name);
          }}
          onKeyDown={handleKeyDown}
          autoFocus
          className='h-8'
        />
      </form>
    );
  }

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <Link
            key={props.channel.id}
            href={`/w/${props.workspace.id}/${props.channel.id}`}
            className={`flex items-center rounded-md px-2 py-1.5 text-sm hover:bg-indigo-100 ${
              props.selected ? 'bg-indigo-100' : ''
            }`}
          >
            # {channelName}
          </Link>
        </ContextMenuTrigger>
        <ContextMenuContent className='w-52'>
          <ContextMenuItem onSelect={() => setIsEditing(true)}>
            <Pencil className='mr-2 h-4 w-4' />
            Rename
          </ContextMenuItem>
          <ContextMenuItem
            onSelect={() => setIsDeleteDialogOpen(true)}
            className='text-red-600'
          >
            <Trash2 className='mr-2 h-4 w-4' />
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Channel</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete #{props.channel.name}? This action
              cannot be undone.
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
}
