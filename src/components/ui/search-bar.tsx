import { Loader2, Search, X } from 'lucide-react';
import { forwardRef, useEffect, useState } from 'react';
import { useDebounce } from 'use-debounce';
import { Button } from './button';
import { Input } from './input';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
  className?: string;
  onFocus?: () => void;
}

export const SearchBar = forwardRef<HTMLInputElement, SearchBarProps>(
  (
    {
      value,
      onChange,
      placeholder = 'Search...',
      debounceMs = 300,
      className,
      onFocus,
    },
    ref,
  ) => {
    const [localValue, setLocalValue] = useState(value);
    const [debouncedValue] = useDebounce(localValue, debounceMs, {
      leading: true,
    });
    const isDebouncing = localValue !== debouncedValue;

    useEffect(() => {
      onChange(debouncedValue);
    }, [debouncedValue]);

    return (
      <Input
        ref={ref}
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onFocus={onFocus}
        placeholder={placeholder}
        className={className}
        leftSection={<Search className='h-4 w-4' />}
        rightSection={
          localValue &&
          (isDebouncing ? (
            <Loader2 className='h-4 w-4 animate-spin mr-2' />
          ) : (
            <Button
              variant='ghost'
              size='icon'
              className='h-8 w-8'
              onClick={() => setLocalValue('')}
            >
              <X className='h-5 w-5' />
            </Button>
          ))
        }
      />
    );
  },
);

SearchBar.displayName = 'SearchBar';
