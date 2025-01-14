'use client';

import AssistantView from '@/components/assistant-view';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import WorkspaceSidebar from '@/components/workspace-sidebar';
import { setCookie } from 'cookies-next';
import { throttle } from 'lodash';

const LAYOUT_COOKIE_NAME = 'slackr-layout';

/** Save layout to cookie */
const onLayout = throttle(
  (sizes: number[]) => {
    setCookie(LAYOUT_COOKIE_NAME, JSON.stringify(sizes));
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
        <AssistantView />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
