import { useWorkspace } from '@/contexts/workspace-context';
import { api } from '@/trpc/react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Channel } from '@prisma/client';
import { Loader2Icon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { SearchBar } from './ui/search-bar';
import { Separator } from './ui/separator';

const createChannelSchema = z.object({
  mode: z.enum(['create', 'join']),
  channelName: z.string().min(1).max(32).optional().or(z.literal('')),
});

type CreateChannelForm = z.infer<typeof createChannelSchema>;

interface CreateChannelDialogProps {
  trigger: React.ReactNode;
  onSubmit: (data: {
    mode: 'create' | 'join';
    channelName?: string;
    channelId?: string;
  }) => void;
  onOpenChange?: (open: boolean) => void;
  existingChannels: Channel[];
  workspaceId: string;
}

export function CreateChannelDialog({
  trigger,
  onSubmit,
  onOpenChange,
  existingChannels,
  workspaceId,
}: CreateChannelDialogProps) {
  const router = useRouter();
  const utils = api.useUtils();
  const { refetchWorkspace } = useWorkspace();

  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChannelId, setSelectedChannelId] = useState<string>();
  const [loading, setLoading] = useState(false);

  const createChannel = api.channel.create.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.channel.getAllWithMembership.invalidate({ workspaceId }),
        utils.workspace.getById.invalidate({ workspaceId }),
        utils.workspace.getMembers.invalidate({ workspaceId }),
      ]);
      await refetchWorkspace();
    },
  });

  const joinChannel = api.channel.join.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.channel.getAllWithMembership.invalidate({ workspaceId }),
        utils.workspace.getById.invalidate({ workspaceId }),
        utils.workspace.getMembers.invalidate({ workspaceId }),
      ]);
      await refetchWorkspace();
    },
  });

  const form = useForm<CreateChannelForm>({
    resolver: zodResolver(createChannelSchema),
    defaultValues: {
      mode: 'create',
      channelName: '',
    },
  });

  const mode = form.watch('mode');
  const channelName = form.watch('channelName');

  const filteredChannels = useMemo(
    () =>
      existingChannels
        .filter((channel) =>
          searchQuery
            ? channel.name.toLowerCase().includes(searchQuery.toLowerCase())
            : true,
        )
        .slice(0, 5),
    [existingChannels, searchQuery],
  );

  const handleSubmit = async (data: CreateChannelForm) => {
    setLoading(true);
    try {
      if (data.mode === 'create' && data.channelName) {
        const channel = await createChannel.mutateAsync({
          workspaceId,
          name: data.channelName,
        });
        onSubmit({ mode: 'create', channelName: data.channelName });
        router.push(`/w/${workspaceId}/${channel.id}`);
      } else if (data.mode === 'join' && selectedChannelId) {
        await joinChannel.mutateAsync({
          channelId: selectedChannelId,
        });
        onSubmit({ mode: 'join', channelId: selectedChannelId });
        router.push(`/w/${workspaceId}/${selectedChannelId}`);
      }
      setOpen(false);

      form.reset();
      setSearchQuery('');
      setSelectedChannelId(undefined);
    } catch (error) {
      console.error('Failed to create/join channel:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(newOpen) => {
        setOpen(newOpen);
        onOpenChange?.(newOpen);
        if (!newOpen) {
          form.reset();
          setSearchQuery('');
          setSelectedChannelId(undefined);
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create or Join Channel</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(handleSubmit)}
          className='mt-2 space-y-4'
        >
          <RadioGroup
            defaultValue='create'
            onValueChange={(value) => {
              form.setValue('mode', value as 'create' | 'join');
              if (value === 'join') {
                form.setValue('channelName', '');
              }
            }}
            className='space-y-2'
          >
            <div className='flex items-center space-x-2'>
              <RadioGroupItem value='create' id='create' />
              <Label htmlFor='create'>Create new channel</Label>
            </div>
            <div className='flex items-center space-x-2'>
              <RadioGroupItem value='join' id='join' />
              <Label htmlFor='join'>Join existing channel</Label>
            </div>
          </RadioGroup>

          <Separator />

          {mode === 'create' ? (
            <div className='space-y-1'>
              <Label htmlFor='channelName'>Channel name</Label>
              <Input
                id='channelName'
                placeholder='Enter channel name'
                {...form.register('channelName')}
              />
              {form.formState.errors.channelName && (
                <p className='text-sm text-destructive'>
                  {form.formState.errors.channelName.message}
                </p>
              )}
            </div>
          ) : (
            <div className='space-y-4'>
              <SearchBar
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder='Search channels...'
              />
              <div className='flex flex-col'>
                {filteredChannels.length > 0 ? (
                  filteredChannels.map((channel) => (
                    <Button
                      key={channel.id}
                      type='button'
                      variant='ghost'
                      className={`justify-start ${
                        selectedChannelId === channel.id ? 'bg-accent' : ''
                      }`}
                      onClick={() => setSelectedChannelId(channel.id)}
                    >
                      # {channel.name}
                    </Button>
                  ))
                ) : searchQuery ? (
                  <p className='text-sm text-muted-foreground'>
                    No channels found
                  </p>
                ) : null}
              </div>
            </div>
          )}

          <div className='flex justify-end space-x-2'>
            <Button
              type='button'
              variant='outline'
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type='submit'
              disabled={
                loading ||
                (mode === 'create' ? !channelName : !selectedChannelId)
              }
            >
              {loading && <Loader2Icon className='mr-2 h-4 w-4 animate-spin' />}
              {mode === 'create' ? 'Create' : 'Join'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
