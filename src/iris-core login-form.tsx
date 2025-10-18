"use client";

import { authenticate } from "@/app/login/actions";
import { doClearBalance } from "@/lib/features/costTrackerSlice";
import { useAppDispatch } from "@/lib/hooks";
import { getMessageFromCode } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { useEffect } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { toast } from "sonner";
import { IconSpinner } from "./ui/icons";

export default function LoginForm() {
	const [result, dispatch] = useFormState(authenticate, undefined);

	const appDispatch = useAppDispatch();

	// biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
	useEffect(() => {
		if (result) {
			if (result.type === "error") {
				toast.error(getMessageFromCode(result.resultCode));
			} else {
				toast.success(getMessageFromCode(result.resultCode));
				appDispatch(doClearBalance());
				redirect("/");
			}
		}
	}, [result]);

	return (
		<div className="flex bg-white " style={{ height: "calc(100vh )" }}>
			{/* Left sidebar */}
			<div className="hidden w-1/2 bg-[#F3FAFB] p-10 lg:flex flex-col justify-center items-center">
				{" "}
				{/* Cambiado justify-between a justify-center y añadido items-center */}
				<Image
					src="/images/iris-logo.png"
					alt="Iris Logo"
					width={150} // Aumentado de 64 a 150
					height={150} // Aumentado de 64 a 150
					className="mx-auto mb-4"
				/>
			</div>
			{/* Right content area */}
			<div className="w-full h-full lg:w-1/2">
				<div className="flex justify-end m-6">
					<Link href="/signup">
						<div data-cy="create-account-btn" className="font-semibold">
							Create An Account
						</div>
					</Link>
				</div>
				<div
					className="flex h-screen items-center justify-center p-8"
					style={{ height: "calc(100vh - 200px)" }}
				>
					<div className="w-full max-w-md space-y-8">
						<div className="text-center">
							<h2 className="mt-6 text-3xl font-bold">Login</h2>
							<p className="mt-2 text-sm text-gray-600">
								Enter your email below to create your account
							</p>
						</div>
						<form className="mt-8 space-y-6" action={dispatch}>
							<input
								className="peer block w-full rounded-md border px-2 py-[9px] text-sm outline-none placeholder:text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950"
								id="email"
								data-cy="email"
								type="email"
								name="email"
								placeholder="Enter your email address"
								required
							/>
							<input
								className="peer block w-full rounded-md border px-2 py-[9px] text-sm outline-none placeholder:text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950"
								id="password"
								data-cy="password"
								type="password"
								name="password"
								placeholder="Enter password"
								required
								minLength={6}
							/>
							<LoginButton />
						</form>
					</div>
				</div>
			</div>
		</div>
	);
}

function LoginButton() {
	const { pending } = useFormStatus();

	return (
		// biome-ignore lint/a11y/useButtonType: <explanation>
		<button
			data-cy="loginBtn"
			className="my-4 flex h-10 w-full flex-row items-center justify-center rounded-md bg-zinc-900 p-2 text-sm font-semibold text-zinc-100 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
			aria-disabled={pending}
		>
			{pending ? <IconSpinner /> : "Log in"}
		</button>
	);
}
