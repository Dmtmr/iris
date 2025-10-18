import { PromptForm } from '@/components/prompt-form';
import { useAppSelector } from '@/lib/hooks';
import * as React from 'react';

export interface ChatPanelProps {
  title?: string;
  senderId: string;
}

export function ChatPanel({ senderId }: ChatPanelProps) {
  const inputRef = React.useRef<HTMLTextAreaElement>(null);
  const { companyProfileSidebarStatus } = useAppSelector(
    (state) => state.sidebar
  );

  const width = companyProfileSidebarStatus ? 'w-[41.5%]' : 'w-full';

  return (
    <div
      className={`${width} transition-all ease-in-out duration-500 delay-0 absolute bottom-0  bg-gradient-to-b from-transparent via-[#f5f5f5] via-20% to-[#f5f5f5]`}
    >
      <div className="inset-x-0 bg-gradient-to-b from-muted/30 from-0% to-muted/30 to-50% duration-300 ease-in-out animate-in dark:from-background/10 dark:from-10% dark:to-background/80 peer-[[data-state=open]]:group-[]:lg:pl-[250px] peer-[[data-state=open]]:group-[]:xl:pl-[300px]">
        <div className="mx-auto max-w-4xl w-4xl px-4 pt-8 ">
          <div className="mt-4">
            <PromptForm ref={inputRef} senderId={senderId} />
            {/* <FooterText className="hidden sm:block" /> */}
          </div>
        </div>
      </div>
    </div>
  );
}
