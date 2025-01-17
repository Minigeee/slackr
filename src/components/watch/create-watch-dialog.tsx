'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/trpc/react';
import { useState } from 'react';

export function CreateWatchDialog() {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [lookbackHours, setLookbackHours] = useState('48');
  const [minRelevanceScore, setMinRelevanceScore] = useState('0.8');

  const utils = api.useContext();
  const createMutation = api.watch.create.useMutation({
    onSuccess: () => {
      setOpen(false);
      utils.watch.getAll.invalidate().catch(console.error);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      prompt,
      lookbackHours: parseInt(lookbackHours),
      minRelevanceScore: parseFloat(minRelevanceScore),
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant='outline' size='icon'>
          <span className='sr-only'>Create new watch prompt</span>
          <svg
            xmlns='http://www.w3.org/2000/svg'
            viewBox='0 0 24 24'
            fill='none'
            stroke='currentColor'
            strokeWidth='2'
            strokeLinecap='round'
            strokeLinejoin='round'
            className='h-4 w-4'
          >
            <path d='M5 12h14' />
            <path d='M12 5v14' />
          </svg>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create Watch Prompt</DialogTitle>
            <DialogDescription>
              Get notified when messages match your watch criteria.
            </DialogDescription>
          </DialogHeader>

          <div className='grid gap-4 py-4'>
            <div className='space-y-2'>
              <label htmlFor='prompt' className='text-sm font-medium'>
                Prompt
              </label>
              <Textarea
                id='prompt'
                placeholder='What topics would you like to watch for?'
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                required
              />
            </div>

            <div className='grid grid-cols-2 gap-4'>
              <div className='space-y-2'>
                <label htmlFor='lookback' className='text-sm font-medium'>
                  Look Back Period
                </label>
                <Select value={lookbackHours} onValueChange={setLookbackHours}>
                  <SelectTrigger id='lookback'>
                    <SelectValue placeholder='Select hours' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='24'>24 hours</SelectItem>
                    <SelectItem value='48'>48 hours</SelectItem>
                    <SelectItem value='96'>96 hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className='space-y-2'>
                <label htmlFor='relevance' className='text-sm font-medium'>
                  Min Relevance Score
                </label>
                <Input
                  id='relevance'
                  type='number'
                  min='0'
                  max='1'
                  step='0.01'
                  value={minRelevanceScore}
                  onChange={(e) => setMinRelevanceScore(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type='button'
              disabled={createMutation.isPending}
              variant='outline'
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type='submit' disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Create Watch'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
