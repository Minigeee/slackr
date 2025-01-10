import { Loader2Icon } from 'lucide-react';
import { MouseEvent, forwardRef, useCallback, useState } from 'react';
import { Button, ButtonProps } from './button';

export type AsyncButtonProps = Omit<ButtonProps, 'onClick'> & {
  /** Should the loader replace the button contents */
  replace?: boolean;
  /** Custom loader */
  loader?: JSX.Element;
  /** (Async) click button */
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void | Promise<void>;
};

const AsyncButton = forwardRef<HTMLButtonElement, AsyncButtonProps>(
  (props, ref) => {
    // Used to indicate loading
    const [loading, setLoading] = useState<boolean>(false);

    // click fn
    const onClick = useCallback(
      (e: MouseEvent<HTMLButtonElement>) => {
        if (!props.onClick) return;

        // Call fn
        const promise = props.onClick(e);

        // If async
        if (promise?.catch) {
          // Start loading
          setLoading(true);

          // Call fn
          promise
            .catch((error) => {
              console.error('Async action error', error);
            })
            .finally(() => setLoading(false));
        }
      },
      [loading, props.onClick],
    );

    return (
      <Button
        ref={ref}
        {...props}
        disabled={props.disabled ?? loading}
        onClick={onClick}
      >
        {loading &&
          (props.loader ?? (
            <Loader2Icon className='mr-2 h-4 w-4 animate-spin' />
          ))}
        {(!loading || !props.replace) && props.children}
      </Button>
    );
  },
);
AsyncButton.displayName = 'AsyncButton';

export { AsyncButton };
