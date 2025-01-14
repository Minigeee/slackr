'use client';

import { SparklesIcon } from 'lucide-react';
import { useState } from 'react';
import { AssistantDialog } from '../assistant-dialog';
import { Button } from '../ui/button';

/* TEMP : Convo RAG data
const data = [
  {
    id: 'vec1',
    text: 'Apple is a popular fruit known for its sweetness and crisp texture.',
  },
  {
    id: 'vec2',
    text: 'The tech company Apple is known for its innovative products like the iPhone.',
  },
  { id: 'vec3', text: 'Many people enjoy eating apples as a healthy snack.' },
  {
    id: 'vec4',
    text: 'Apple Inc. has revolutionized the tech industry with its sleek designs and user-friendly interfaces.',
  },
  {
    id: 'vec5',
    text: 'An apple a day keeps the doctor away, as the saying goes.',
  },
  {
    id: 'vec6',
    text: 'Apple Computer Company was founded on April 1, 1976, by Steve Jobs, Steve Wozniak, and Ronald Wayne as a partnership.',
  },
]; */

export default function Assistant() {
  const [open, setOpen] = useState(false);

  return (
    <AssistantDialog open={open} onOpenChange={setOpen}>
      <Button
        variant='ghost'
        size='icon'
        onClick={() => setOpen(true)}
        className='text-primary-foreground hover:bg-violet-900 hover:text-primary-foreground'
      >
        <SparklesIcon className='w-4 h-4' />
      </Button>
    </AssistantDialog>
  );
}
