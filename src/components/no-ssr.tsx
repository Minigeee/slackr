'use client';

import { cn } from '@/lib/utils';
import { Loader2Icon } from 'lucide-react';
import { PropsWithChildren, useEffect, useState } from 'react';

export default function NoSsr(
  props: PropsWithChildren & { className?: string },
) {
  const [client, setClient] = useState(false);

  useEffect(() => {
    setClient(true);
  }, []);

  if (!client) {
    return (
      <div
        className={cn(
          'flex h-full w-full items-center justify-center',
          props.className,
        )}
      >
        <Loader2Icon className='text-brand h-6 w-6 animate-spin' />
      </div>
    );
  }

  return props.children;
}
