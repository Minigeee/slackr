import { cn } from '@/lib/utils';
import * as React from 'react';

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  leftSection?: React.ReactNode;
  rightSection?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, leftSection, rightSection, ...props }, ref) => {
    return (
      <div className='relative'>
        {leftSection && (
          <div className='absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground'>
            {leftSection}
          </div>
        )}
        <input
          type={type}
          className={cn(
            'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
            leftSection && 'pl-10',
            rightSection && 'pr-10',
            className,
          )}
          ref={ref}
          {...props}
        />
        {rightSection && (
          <div className='absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground'>
            {rightSection}
          </div>
        )}
      </div>
    );
  },
);
Input.displayName = 'Input';

export { Input };
