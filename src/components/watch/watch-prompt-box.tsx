import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { api } from '@/trpc/react';
import { type WatchPrompt } from '@prisma/client';
import { Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { Button } from '../ui/button';
import { EditWatchDialog } from './edit-watch-dialog';

interface WatchPromptBoxProps {
  prompt: WatchPrompt;
  matches?: Array<{
    id: string;
    content: string;
    channelName: string;
    createdAt: Date;
    score?: number;
  }>;
}

export function WatchPromptBox({ prompt, matches = [] }: WatchPromptBoxProps) {
  const params = useParams<{ workspaceId: string }>();
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);

  const utils = api.useContext();
  const deleteMutation = api.watch.delete.useMutation({
    onSuccess: () => {
      utils.watch.getAll.invalidate().catch(console.error);
    },
  });

  return (
    <div className='space-y-2 rounded-lg border bg-card p-4'>
      <div className='flex items-start justify-between'>
        <div>
          <h3 className='font-medium'>{prompt.prompt}</h3>
          <p className='text-sm text-muted-foreground'>
            Looking back {prompt.lookbackHours}h • Min score{' '}
            {prompt.minRelevanceScore}
            {!prompt.isActive && ' • Inactive'}
          </p>
        </div>
        <div className='flex items-center gap-1'>
          <EditWatchDialog prompt={prompt} />
          <Button
            variant='outline'
            size='icon'
            onClick={() => setShowDeleteAlert(true)}
            className='w-8 h-8'
          >
            <Trash2 className='h-4 w-4 text-destructive' />
            <span className='sr-only'>Delete watch prompt</span>
          </Button>
        </div>
      </div>

      <div className='space-y-2'>
        {matches.length > 0 ? (
          matches.map((match) => (
            <Link
              key={match.id}
              href={`/w/${params.workspaceId}/search?msg=${match.id}`}
              className='block rounded-md bg-muted p-2 hover:bg-muted/80'
            >
              <div className='flex items-center justify-between'>
                <span className='text-sm font-medium'>
                  #{match.channelName}
                </span>
                <div className='flex items-center gap-2'>
                  {/* match.score && (
                    <span className="text-xs text-muted-foreground">
                      Score: {match.score.toFixed(2)}
                    </span>
                  ) */}
                  <span className='text-xs text-muted-foreground'>
                    {new Date(match.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>
              <div
                className='mt-1 text-sm text-muted-foreground line-clamp-2 prose'
                dangerouslySetInnerHTML={{ __html: match.content }}
              />
            </Link>
          ))
        ) : (
          <p className='text-sm text-muted-foreground'>No matches yet</p>
        )}
      </div>

      <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Watch Prompt</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this watch prompt? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                deleteMutation.mutate({ id: prompt.id });
                setShowDeleteAlert(false);
              }}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
