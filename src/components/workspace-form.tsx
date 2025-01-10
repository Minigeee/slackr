'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useFormStatus } from 'react-dom';

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type='submit' className='w-full' disabled={pending}>
      {pending ? (
        <>
          <Loader2 className='mr-2 h-4 w-4 animate-spin' />
          Creating...
        </>
      ) : (
        'Create Workspace'
      )}
    </Button>
  );
}

export function WorkspaceForm({
  onSubmit,
}: {
  onSubmit: (formData: FormData) => Promise<{ error: string } | undefined>;
}) {
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setError(null);
    const result = await onSubmit(formData);
    if (result?.error) {
      setError(result.error);
    }
  }

  return (
    <div className='flex min-h-screen items-center justify-center'>
      <Card className='w-full max-w-md'>
        <CardHeader>
          <CardTitle>Create Your First Workspace</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={handleSubmit}>
            <Input
              type='text'
              name='name'
              placeholder='Workspace Name'
              required
              className='mb-4'
            />
            {error && <p className='text-sm text-red-500 mb-4'>{error}</p>}
            <SubmitButton />
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
