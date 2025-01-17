'use client';

import AssistantView from '@/components/assistant-view';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import WatchView from '@/components/watch/watch-view';
import WorkspaceSidebar from '@/components/workspace-sidebar';
import { setCookie } from 'cookies-next';
import { throttle } from 'lodash';

const LAYOUT_COOKIE_NAME = 'slackr-layout';

/** Save layout to cookie */
const onLayout = throttle(
  async (sizes: number[]) => {
    await setCookie(LAYOUT_COOKIE_NAME, JSON.stringify(sizes));
  },
  200,
  { trailing: true },
);

export default function Main({
  children,
  defaultLayout,
}: {
  children: React.ReactNode;
  defaultLayout: number[];
}) {
  const defaultSizes = defaultLayout ?? [20, 60, 20];

  return (
    <ResizablePanelGroup
      direction='horizontal'
      className='flex-grow'
      onLayout={onLayout}
    >
      <ResizablePanel defaultSize={defaultSizes[0]}>
        <WorkspaceSidebar />
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel defaultSize={defaultSizes[1]}>{children}</ResizablePanel>
      <ResizableHandle />
      <ResizablePanel defaultSize={defaultSizes[2]}>
        <Tabs defaultValue='assistant' className='h-full'>
          <TabsList className='w-full justify-start'>
            <TabsTrigger value='assistant'>Assistant</TabsTrigger>
            <TabsTrigger value='watch'>Watch List</TabsTrigger>
          </TabsList>
          <TabsContent value='assistant' className='h-[calc(100%-45px)]'>
            <AssistantView />
          </TabsContent>
          <TabsContent value='watch' className='h-[calc(100%-45px)]'>
            <WatchView />
          </TabsContent>
        </Tabs>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
