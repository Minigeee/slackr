'use client';

import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog';
import * as React from 'react';

import { ButtonProps, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Loader2Icon } from 'lucide-react';
import { Input } from './input';

const AlertDialog = AlertDialogPrimitive.Root;

const AlertDialogTrigger = AlertDialogPrimitive.Trigger;

const AlertDialogPortal = AlertDialogPrimitive.Portal;

const AlertDialogOverlay = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Overlay
    className={cn(
      'fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className,
    )}
    {...props}
    ref={ref}
  />
));
AlertDialogOverlay.displayName = AlertDialogPrimitive.Overlay.displayName;

const AlertDialogContent = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content>
>(({ className, ...props }, ref) => (
  <AlertDialogPortal>
    <AlertDialogOverlay />
    <AlertDialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg',
        className,
      )}
      {...props}
    />
  </AlertDialogPortal>
));
AlertDialogContent.displayName = AlertDialogPrimitive.Content.displayName;

const AlertDialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex flex-col space-y-2 text-center sm:text-left',
      className,
    )}
    {...props}
  />
);
AlertDialogHeader.displayName = 'AlertDialogHeader';

const AlertDialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2',
      className,
    )}
    {...props}
  />
);
AlertDialogFooter.displayName = 'AlertDialogFooter';

const AlertDialogTitle = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Title
    ref={ref}
    className={cn('text-lg font-semibold', className)}
    {...props}
  />
));
AlertDialogTitle.displayName = AlertDialogPrimitive.Title.displayName;

const AlertDialogDescription = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Description
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
));
AlertDialogDescription.displayName =
  AlertDialogPrimitive.Description.displayName;

const AlertDialogAction = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Action>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Action> &
    ButtonProps
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Action
    ref={ref}
    className={cn(buttonVariants({ variant: props.variant }), className)}
    {...props}
  />
));
AlertDialogAction.displayName = AlertDialogPrimitive.Action.displayName;

const AlertDialogCancel = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Cancel>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Cancel>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Cancel
    ref={ref}
    className={cn(
      buttonVariants({ variant: 'outline' }),
      'mt-2 sm:mt-0',
      className,
    )}
    {...props}
  />
));
AlertDialogCancel.displayName = AlertDialogPrimitive.Cancel.displayName;

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
  AlertDialogTrigger,
};

////////////////////////////////////////////////////////////

/** Props */
export type DefaultAlertDialogFooterProps = {
  /** The label shown on the action button */
  actionLabel?: string;
  /** Action button variant */
  actionVariant?: ButtonProps['variant'];
  /** Determines if action button should be disabled */
  actionDisabled?: boolean;
  /** Function called when user cancels */
  onCancel?: () => void;
  /** Function called when user actions */
  onAction?: () => Promise<void> | void;
  /** Needed to close dialog */
  onOpenChange?: (open: boolean) => void;
};

/** Default footer layout for alert dialog */
export function DefaultAlertDialogFooter(props: DefaultAlertDialogFooterProps) {
  const [loading, setLoading] = React.useState<boolean>(false);

  // click fn
  const onAction = React.useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      if (!props.onAction) return;

      // Call fn
      const promise = props.onAction();

      // If async
      if (promise?.catch) {
        e.preventDefault();

        // Start loading
        setLoading(true);

        // Call fn
        promise
          .then(() => props.onOpenChange?.(false))
          .catch(() => {})
          .finally(() => setLoading(false));
      }
    },
    [props.onAction],
  );

  return (
    <AlertDialogFooter>
      <AlertDialogCancel onClick={props.onCancel}>Cancel</AlertDialogCancel>
      <AlertDialogAction
        variant={props.actionVariant}
        disabled={props.actionDisabled || loading}
        onClick={onAction}
      >
        {loading && <Loader2Icon className='mr-2 h-4 w-4 animate-spin' />}
        {props.actionLabel || 'Continue'}
      </AlertDialogAction>
    </AlertDialogFooter>
  );
}

////////////////////////////////////////////////////////////

/** Props */
export type StrictAlertDialogProps = DefaultAlertDialogFooterProps & {
  /** The title of the modal */
  title: string;
  /** Modal content */
  content: React.ReactNode;
  /** String user must type */
  type: string;
};

/** Extra strict alert, where user has to type a string to continue */
export function StrictAlertDialog({
  title,
  content,
  type,
  ...props
}: StrictAlertDialogProps) {
  const [text, setText] = React.useState<string>('');

  return (
    <>
      <AlertDialogHeader>
        <AlertDialogTitle>{title}</AlertDialogTitle>
        <AlertDialogDescription>{content}</AlertDialogDescription>
      </AlertDialogHeader>

      <div className='space-y-2'>
        <p className=''>
          Please type <b>{type}</b> to continue.
        </p>
        <Input autoFocus onChange={(e) => setText(e.target.value)} />
      </div>

      <DefaultAlertDialogFooter
        {...props}
        actionDisabled={props.actionDisabled || text !== type}
      />
    </>
  );
}
