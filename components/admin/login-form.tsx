"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "@/app/admin/actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, {});

  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="username" className="mb-1 block text-sm font-medium text-zinc-700">
          Username
        </label>
        <input
          id="username"
          name="username"
          autoComplete="username"
          required
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
        />
      </div>
      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium text-zinc-700">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
        />
      </div>
      {state.error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-600 disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
