"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signIn, signUp, type AuthResult } from "@/lib/auth/actions";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const action = mode === "login" ? signIn : signUp;
  const [state, formAction, pending] = useActionState<AuthResult, FormData>(
    action,
    undefined,
  );

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-sm flex-col justify-center px-6">
      <Link href="/" className="mb-6 text-lg font-semibold tracking-tight">
        CreatorCut
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">
        {mode === "login" ? "Welcome back" : "Create your account"}
      </h1>

      <form action={formAction} className="mt-6 flex flex-col gap-3">
        {mode === "signup" && (
          <Field name="full_name" type="text" label="Name" autoComplete="name" />
        )}
        <Field name="email" type="email" label="Email" autoComplete="email" required />
        <Field
          name="password"
          type="password"
          label="Password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          required
        />

        {state?.error && <p className="text-sm text-red-500">{state.error}</p>}

        <button
          type="submit"
          disabled={pending}
          className="mt-2 rounded-full bg-foreground px-4 py-2.5 text-sm font-medium text-background disabled:opacity-60"
        >
          {pending ? "…" : mode === "login" ? "Log in" : "Sign up"}
        </button>
      </form>

      <p className="mt-4 text-sm text-foreground/60">
        {mode === "login" ? (
          <>
            No account?{" "}
            <Link href="/signup" className="font-medium text-foreground underline">
              Sign up
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-foreground underline">
              Log in
            </Link>
          </>
        )}
      </p>
    </div>
  );
}

function Field({
  name,
  type,
  label,
  autoComplete,
  required,
}: {
  name: string;
  type: string;
  label: string;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-foreground/70">{label}</span>
      <input
        name={name}
        type={type}
        autoComplete={autoComplete}
        required={required}
        className="rounded-lg border border-foreground/15 bg-transparent px-3 py-2 outline-none focus:border-foreground/40"
      />
    </label>
  );
}
