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
import { WatchPrompt } from '@prisma/client';
import { Pencil } from 'lucide-react';
import { useState } from 'react';

interface EditWatchDialogProps {
  prompt: WatchPrompt;
}

export function EditWatchDialog({ prompt }: EditWatchDialogProps) {
  const [open, setOpen] = useState(false);
  const [promptText, setPromptText] = useState(prompt.prompt);
  const [lookbackHours, setLookbackHours] = useState(prompt.lookbackHours.toString());
  const [minRelevanceScore, setMinRelevanceScore] = useState(prompt.minRelevanceScore.toString());
  const [isActive, setIsActive] = useState(prompt.isActive);
  
  const utils = api.useContext();
  const editMutation = api.watch.update.useMutation({
    onSuccess: () => {
      setOpen(false);
      utils.watch.getAll.invalidate();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    editMutation.mutate({
      id: prompt.id,
      prompt: promptText,
      lookbackHours: parseInt(lookbackHours),
      minRelevanceScore: parseFloat(minRelevanceScore),
      isActive,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" className='w-8 h-8'>
          <Pencil className="h-4 w-4" />
          <span className="sr-only">Edit watch prompt</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Watch Prompt</DialogTitle>
            <DialogDescription>
              Modify your watch criteria for better matches.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <label htmlFor="prompt" className="text-sm font-medium">
                Prompt
              </label>
              <Textarea
                id="prompt"
                placeholder="What topics would you like to watch for?"
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="lookback" className="text-sm font-medium">
                  Look Back Period
                </label>
                <Select
                  value={lookbackHours}
                  onValueChange={setLookbackHours}
                >
                  <SelectTrigger id="lookback">
                    <SelectValue placeholder="Select hours" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="24">24 hours</SelectItem>
                    <SelectItem value="48">48 hours</SelectItem>
                    <SelectItem value="96">96 hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label htmlFor="relevance" className="text-sm font-medium">
                  Min Relevance Score
                </label>
                <Input
                  id="relevance"
                  type="number"
                  min="0"
                  max="1"
                  step="0.01"
                  value={minRelevanceScore}
                  onChange={(e) => setMinRelevanceScore(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="active"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <label htmlFor="active" className="text-sm font-medium">
                Active
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={editMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={editMutation.isPending}>
              {editMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
} 