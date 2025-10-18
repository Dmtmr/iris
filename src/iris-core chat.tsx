'use client';

import { createChatSession } from '@/app/chat/actions';
import { ChatList } from '@/components/chat-list';
import { ChatPanel } from '@/components/chat-panel';
import { EmptyScreen } from '@/components/empty-screen';
import { ScrollArea } from '@/components/ui/scroll-area';
import { doListMessages } from '@/lib/features/chat/messagesSlice';
import { useAppDispatch, useAppSelector } from '@/lib/hooks';
import { useLocalStorage } from '@/lib/hooks/use-local-storage';
import type { UserSession } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useCallback, useEffect } from 'react';
import SidebarPreviewPPT from './sidebar-ppt';
import DecksFinancialSidebar from './ui/assistant-ui/decks-financial-sidebar';
import { localStorageItems } from '@/constants/global.constants';
import { getSessionId } from '@/lib/hooks/global-hooks';

export interface ChatProps extends React.ComponentProps<'div'> {
  defaultSessionId?: string;
  userSession: UserSession;
}

export function Chat({ defaultSessionId, userSession }: ChatProps) {
  const dispatch = useAppDispatch();
  const [_, setSessionId] = useLocalStorage(
    localStorageItems.sessionId,
    defaultSessionId
  );
  const { messages, messagesStatus } = useAppSelector(
    (state) => state.messages
  );
  const { companyProfileSidebarStatus } = useAppSelector(
    (state) => state.sidebar
  );

  const onGetSessionId = useCallback(async () => {
    const currentSessionId = await getSessionId(defaultSessionId);
    window.history.replaceState({}, '', `/chat/${currentSessionId}`);
    setSessionId(currentSessionId);
    createChatSession(currentSessionId);
    getMessages(currentSessionId);
  }, [defaultSessionId]);

  useEffect(() => {
    onGetSessionId();
  }, [onGetSessionId]);

  const getMessages = (sessionId: string) => {
    if (messagesStatus === 'empty') {
      dispatch(doListMessages(sessionId));
    }
  };

  return (
    <ScrollArea className="overflow-auto">
      <div
        className={`h-full group w-full pl-0 peer-[[data-state=open]]:lg:pl-[250px] peer-[[data-state=open]]:xl:pl-[300px]
          transition-all ease-in-out duration-1000 delay-0 ${
            companyProfileSidebarStatus ? ' flex' : ''
          }`}
      >
        <div
          className={`${
            companyProfileSidebarStatus ? ' flex-auto w-[70%]' : ''
          } h-screen flex flex-col`}
        >
          <div className={cn(' items-center grow overflow-y-auto')}>
            {messages.length ? (
              <ChatList messages={messages} />
            ) : (
              <EmptyScreen />
            )}
          </div>
          <ChatPanel senderId={userSession?.user.id} />
        </div>
        <SidebarPreviewPPT />
      </div>
      <DecksFinancialSidebar senderId={userSession?.user.id} />
    </ScrollArea>
  );
}
