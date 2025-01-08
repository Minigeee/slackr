'use client';

import { Message } from '@prisma/client';
import { createContext, useContext, useState, ReactNode } from 'react';

interface ChannelContextType {
  activeThreadId: string | null;
  setActiveThreadId: (id: string | null) => void;
}

const ChannelContext = createContext<ChannelContextType | null>(null);

export function useChannel() {
  const context = useContext(ChannelContext);
  if (!context) {
    throw new Error('useChannel must be used within a ChannelProvider');
  }
  return context;
}

interface ChannelProviderProps {
  children: ReactNode;
  activeThreadId: string | null;
  setActiveThreadId: (id: string | null) => void;
}

export function ChannelProvider({
  children,
  activeThreadId,
  setActiveThreadId,
}: ChannelProviderProps) {
  return (
    <ChannelContext.Provider
      value={{
        activeThreadId,
        setActiveThreadId,
      }}
    >
      {children}
    </ChannelContext.Provider>
  );
} 