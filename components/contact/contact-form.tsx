"use client";

import { useActionState, useState } from "react";
import { submitContact, type ContactField, type ContactState } from "@/app/[locale]/contact/actions";
import type { Locale } from "@/types/content";
import { cn } from "@/lib/utils";

interface Copy {
  formTitle: string;
  name: string;
  emailField: string;
  topic: string;
  topics: Record<string, string>;
  message: string;
  messagePlaceholder: string;
  send: string;
  sending: string;
  success: string;
  error: string;
  required: string;
  invalidEmail: string;
  tooShort: string;
}

const initial: ContactState = { status: "idle" };

export function ContactForm({ copy, locale, email }: { copy: Copy; locale: Locale; email: string }) {
  const [state, action, pending] = useActionState(submitContact, initial);
  const [startedAt] = useState(() => Date.now());

  if (state.status === "success") {
    return (
      <div role="status" className="frame border border-line bg-ink-950 p-10">
        <p className="font-pixel text-uv-300">200 · OK</p>
        <p className="font-display mt-4 text-3xl">{copy.success}</p>
      </div>
    );
  }

  const error = (field: ContactField) => {
    const code = state.errors?.[field];
    return code ? copy[code] : null;
  };

  const fieldClass =
    "peer w-full border-0 border-b border-line-strong bg-transparent px-0 py-3 text-lg text-bone placeholder:text-fog/60 transition-colors focus:border-uv-400 focus:outline-none focus:ring-0 aria-[invalid=true]:border-red-400";

  return (
    <form action={action} noValidate className="flex flex-col gap-8" aria-describedby={state.status === "error" ? "form-error" : undefined}>
      <h2 className="label">{copy.formTitle}</h2>

      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="startedAt" value={startedAt} />
      <div aria-hidden className="absolute -start-[9999px] h-px w-px overflow-hidden">
        <label>
          Company
          <input type="text" name="company" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div className="grid gap-8 sm:grid-cols-2">
        <Field id="name" label={copy.name} error={error("name")}>
          <input
            id="name"
            name="name"
            autoComplete="name"
            required
            defaultValue={state.values?.name}
            aria-invalid={!!error("name")}
            aria-describedby={error("name") ? "name-error" : undefined}
            className={fieldClass}
          />
        </Field>
        <Field id="email" label={copy.emailField} error={error("email")}>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            dir="ltr"
            defaultValue={state.values?.email}
            aria-invalid={!!error("email")}
            aria-describedby={error("email") ? "email-error" : undefined}
            className={cn(fieldClass, "rtl:text-end")}
          />
        </Field>
      </div>

      <fieldset>
        <legend className="label mb-4">{copy.topic}</legend>
        <div className="flex flex-wrap gap-2">
          {Object.entries(copy.topics).map(([value, label], i) => (
            <label key={value} className="cursor-pointer">
              <input
                type="radio"
                name="topic"
                value={value}
                defaultChecked={state.values?.topic ? state.values.topic === value : i === 0}
                className="peer sr-only"
              />
              <span className="inline-flex h-10 items-center border border-line px-4 font-mono text-[0.7rem] uppercase tracking-[0.12em] text-mist transition-colors hover:border-line-strong hover:text-bone peer-checked:border-uv-400 peer-checked:bg-uv-500/15 peer-checked:text-bone peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-uv-400">
                {label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <Field id="message" label={copy.message} error={error("message")}>
        <textarea
          id="message"
          name="message"
          rows={6}
          required
          placeholder={copy.messagePlaceholder}
          defaultValue={state.values?.message}
          aria-invalid={!!error("message")}
          aria-describedby={error("message") ? "message-error" : undefined}
          className={cn(fieldClass, "resize-y")}
        />
      </Field>

      {state.status === "error" && !state.errors && (
        <p id="form-error" role="alert" className="text-sm text-red-300">
          {copy.error}{" "}
          <a href={`mailto:${email}`} className="underline" dir="ltr">
            {email}
          </a>
        </p>
      )}

      <div>
        <button
          type="submit"
          disabled={pending}
          data-magnetic
          className="inline-flex h-14 items-center gap-3 bg-bone px-8 font-mono text-[0.72rem] uppercase tracking-[0.16em] text-void transition-colors hover:bg-uv-500 hover:text-white disabled:cursor-wait disabled:opacity-60"
        >
          {pending && <span aria-hidden className="size-2 animate-blink bg-current" />}
          {pending ? copy.sending : copy.send}
        </button>
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col">
      <label htmlFor={id} className="label">
        {label}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} className="mt-2 text-xs text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
