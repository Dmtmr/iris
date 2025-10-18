import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import type { Message } from '@/lib/types';
import { nanoid } from '@/lib/utils';
import React, { useEffect, useRef } from 'react';
import { UserMessage } from './messages/user-message';
import { BotMessage } from './messages/bot-message';
import { SystemMessage } from './messages/system-message';
import { SpinnerMessage } from './messages/spinner-message';

export function ChatList({ messages }: { messages: Message[] }) {
  const endOfMessagesRef = useRef<null | HTMLDivElement>(null);
  const scrollToBottom = () => {
    endOfMessagesRef.current?.scrollIntoView({
      block: 'end',
      behavior: 'smooth',
    });
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  return (
    <ScrollArea className="overflow-auto">
      <div className="relative mx-auto max-w-4xl px-4 pb-[10%]">
        {messages.map(({ message, senderType }, index) => (
          <div key={`message-${nanoid()}`}>
            {senderType === 'Human' && <UserMessage>{message}</UserMessage>}
            {senderType === 'AI' && <BotMessage content={message} />}
            {senderType === 'System' && <SystemMessage content={message} />}
            {index < messages.length - 1 && <Separator className="my-4" />}
            {index === messages.length - 1 && senderType === 'Human' && (
              <SpinnerMessage />
            )}
          </div>
        ))}
      </div>
      <div style={{ float: 'left', clear: 'both' }} ref={endOfMessagesRef} />
    </ScrollArea>
  );
}
