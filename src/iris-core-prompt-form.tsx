"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import UploadModal from "@/components/upload-file-template";
import { localStorageItems } from "@/constants/global.constants";
import { apiRequestChat } from "@/lib/api";
import {
	doCleanupMessages,
	doListMessages,
	doSendMessage,
	doSendMessageWithoutSaving,
	doStreamMessage,
} from "@/lib/features/chat/messagesSlice";
import { doSetInputValue } from "@/lib/features/chat/promtFormSlice";
import { doUpdateCompanyProfile } from "@/lib/features/companyProfileSlice";
import {
	doSetCompanyProfileURL,
	doToggleSidebar,
} from "@/lib/features/sidebarSlice";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { useEnterSubmit } from "@/lib/hooks/use-enter-submit";
import { useLocalStorage } from "@/lib/hooks/use-local-storage";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import { Typography } from "@mui/material";
import { ArrowUpFromLine, ChartLine, Send, X } from "lucide-react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import * as React from "react";
import { forwardRef, useEffect, useState } from "react";
import Textarea from "react-textarea-autosize";
import { v4 as uuidv4 } from "uuid";
import { doRemoveMessageWithoutSaving } from "../lib/features/chat/messagesSlice";
import DecksFinancialSidebarButton from "./ui/assistant-ui/decks-sidebar-button";

export const PromptForm = forwardRef(function PromptForm(
	{
		senderId,
	}: {
		senderId: string;
	},
	ref,
) {
	const { formRef, onKeyDown } = useEnterSubmit();
	const dispatch = useAppDispatch();
	const [sessionId, setSessionId] = useLocalStorage(
		localStorageItems.sessionId,
		"",
	);
	const { inputValue } = useAppSelector((state) => state.promtForm);
	const { companyProfileSidebarStatus } = useAppSelector(
		(state) => state.sidebar,
	);
	const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
	const searchParams = useSearchParams();
	const paramCompanyName = searchParams.get("company_name");
	const paramActionKeyName = searchParams.get("action_key");
	const paramActionName = searchParams.get("action_name");
	const financialAnalysisMode = !!(paramCompanyName && paramActionKeyName);
	const hasRunRef = React.useRef(false);

	// biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
	useEffect(() => {
		const paramCompanyName = searchParams.get("company_name");
		if (paramCompanyName && !hasRunRef.current && financialAnalysisMode) {
			dispatch(doSetInputValue(paramCompanyName));
			formRef.current.message.value = `${paramCompanyName} - ${paramActionName}`;
			formRef?.current.dispatchEvent(
				new Event("submit", { cancelable: true, bubbles: true }),
			);
			hasRunRef.current = true;
		}
	}, [financialAnalysisMode, searchParams, formRef, dispatch]);

	const handleFocus = () => {
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		if ((ref as any).current) {
			// biome-ignore lint/suspicious/noExplicitAny: <explanation>
			(ref as any).current.focus();
		}
	};

	// biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
	useEffect(() => {
		handleFocus();
	}, []);

	const handleNewDialog = () => {
		const newSessionId = uuidv4();
		dispatch(doCleanupMessages());
		dispatch(doSetInputValue(""));
		setSessionId(newSessionId);
		dispatch(doSetCompanyProfileURL(""));
		dispatch(doListMessages(newSessionId));
		window.history.replaceState({}, "", `/chat/${newSessionId}`);
		dispatch(
			doUpdateCompanyProfile({
				sessionId: "",
				companyName: "",
				title: "",
			}),
		);
		dispatch(doToggleSidebar("none"));
	};

	const onMobileBlurFocus = (e: React.FormEvent<HTMLFormElement>) => {
		// Blur focus on mobile
		if (window.innerWidth < 600) {
			// biome-ignore lint/complexity/useLiteralKeys: <explanation>
			e.target["message"]?.blur();
		}
	};

	const onCreateFinancialAnalysis = () => {
		dispatch(doSetCompanyProfileURL(""));
		dispatch(doToggleSidebar("company-profile"));
		dispatch(
			doUpdateCompanyProfile({
				sessionId: "",
				companyName: "",
				title: "",
			}),
		);
	};

	const onBufferAIMessage = async (value: string) => {
		const reader = await apiRequestChat(sessionId, value);
		dispatch(
			doSendMessageWithoutSaving({
				sessionId,
				message: "",
				senderType: "AI",
			}),
		);
		let buffer = "";
		let fullMessage = "";
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			buffer += new TextDecoder().decode(value);
			const messages = buffer.split("\n\n");
			buffer = messages.pop() || ""; // Keep the last incomplete chunk
			for (const message of messages) {
				if (message.trim().startsWith("data: ")) {
					const jsonStr = message.replace("data: ", "");
					const parsed = JSON.parse(jsonStr);
					dispatch(doStreamMessage(parsed.response));
					fullMessage = fullMessage + parsed.response;
				}
			}
		}
		dispatch(
			doSendMessage({
				sessionId,
				message: fullMessage,
				senderType: "AI",
			}),
		);
		dispatch(doRemoveMessageWithoutSaving());
	};

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		onMobileBlurFocus(e);
		// biome-ignore lint/complexity/useLiteralKeys: <explanation>
		const value = inputValue.trim() || e.target["message"].value;
		dispatch(doSetInputValue(""));
		if (!value) return;
		dispatch(
			doSendMessage({
				sessionId,
				message: value,
				senderId,
				senderType: "Human",
			}),
		);
		if (financialAnalysisMode) {
			return onCreateFinancialAnalysis();
		}
		await onBufferAIMessage(value);
	};

	const handleOpenDecks = () => {
		dispatch(doToggleSidebar("decks"));
	};

	const justify = companyProfileSidebarStatus
		? "2xl:flex 2xl:flex justify-between"
		: "flex justify-between";

	return (
		<form ref={formRef} onSubmit={handleSubmit}>
			<div className={`text-neutral-500 pb-2 mb-2 border-b ${justify}`}>
				<div data-cy="chat-options" className="flex">
					<DecksFinancialSidebarButton
						onClick={() => {
							handleOpenDecks();
						}}
						icon={
							<Image
								src="/images/pp-logo.svg"
								width={20}
								height={20}
								alt="Power Point Icon"
							/>
						}
						label="Decks"
					/>
					<DecksFinancialSidebarButton
						onClick={() => {
							handleOpenDecks();
						}}
						icon={
							<div className="bg-[#192638] flex justify-center items-center rounded-full w-[18px] h-[18px]">
								<ChartLine className="text-white" size={12} />
							</div>
						}
						label="Financial Analysis"
					/>
					<Button
						data-cy="upload-btn"
						variant="outline"
						size="sm"
						className="mr-2 bg-transparent hover:bg-neutral-200 text-slate-600 font-normal w-[170px]"
						onClick={() => setIsUploadModalOpen(true)}
					>
						<ArrowUpFromLine className="!w[18px] !h-[18px]" />
						<Typography fontSize={15} fontWeight={500} ml={0.5}>
							Upload
						</Typography>
					</Button>
					<Dialog open={isUploadModalOpen} onOpenChange={setIsUploadModalOpen}>
						<DialogContent>
							<UploadModal
								setOpened={(value) => {
									setIsUploadModalOpen(value);
								}}
							/>
						</DialogContent>
					</Dialog>
				</div>
				{/* biome-ignore lint/a11y/useKeyWithClickEvents: <explanation> */}
				<div
					className="cursor-pointer hover:text-sky-600 flex ml-5 items-center"
					onClick={() => handleNewDialog()}
				>
					<AutoFixHighIcon className="!w-[20px] !h-[20px]" />
					<Typography fontSize={15} fontWeight={500} ml={0.5}>
						New dialog
					</Typography>
				</div>
			</div>
			<div className="relative flex max-h-60 w-full grow flex-col overflow-hidden bg-background px-8 sm:rounded-md sm:border sm:px-12">
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							size="icon"
							className="absolute bg-white hover:bg-white left-0 top-[3px] size-8 rounded-full p-0 sm:left-2"
							onClick={() => {
								setIsUploadModalOpen(true);
							}}
						>
							<AttachFileIcon className="text-gray-400 rotate-45 !w-[20px] !h-[20px]" />
							<span className="sr-only">Attach</span>
						</Button>
					</TooltipTrigger>
					<TooltipContent>Attach</TooltipContent>
				</Tooltip>
				<Textarea
					// biome-ignore lint/suspicious/noExplicitAny: <explanation>
					ref={ref as any}
					data-cy="message-input"
					tabIndex={0}
					onKeyDown={onKeyDown}
					placeholder="Send a message."
					className="max-h-[85px] w-[96%] resize-none bg-transparent py-[10px] focus-within:outline-none sm:text-sm"
					autoFocus
					spellCheck={false}
					autoComplete="off"
					autoCorrect="off"
					name="message"
					rows={3}
					value={inputValue}
					onChange={(e) => dispatch(doSetInputValue(e.target.value))}
				/>
				<div className="absolute right-0">
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								data-cy="send-message-btn"
								type="submit"
								className="bg-white hover:bg-white py-[3px] px-[5px] m-[2px] h-[35.5px] w-[48px]"
							>
								<Send className="text-gray-800 hover:text-sky-600 w-[20px] h-[20px]" />
								<span className="sr-only">Send message</span>
							</Button>
						</TooltipTrigger>
						<TooltipContent>Send message</TooltipContent>
					</Tooltip>
				</div>
			</div>
		</form>
	);
});
