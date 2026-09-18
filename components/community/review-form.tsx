"use client";

import { useActionState, useState } from "react";
import { submitReview, type ReviewField, type ReviewState } from "@/app/[locale]/community/actions";
import type { Locale } from "@/types/content";
import { cn } from "@/lib/utils";

interface Copy {
  formTitle: string;
  game: string;
  chooseGame: string;
  rating: string;
  ratingHint: string;
  name: string;
  email: string;
  emailHint: string;
  review: string;
  reviewPlaceholder: string;
  submit: string;
  submitting: string;
  success: string;
  error: string;
  required: string;
  invalidEmail: string;
  tooShort: string;
  noRating: string;
  moderationNote: string;
  stars: string;
  star: string;
}

const initial: ReviewState = { status: "idle" };

export function ReviewForm({
  copy,
  locale,
  games,
  defaultGameId,
}: {
  copy: Copy;
  locale: Locale;
  games: { id: string; title: string }[];
  defaultGameId?: string;
}) {
  const [state, action, pending] = useActionState(submitReview, initial);
  const [startedAt] = useState(() => Date.now());
  const [rating, setRating] = useState(0);

  if (state.status === "success") {
    return (
      <div role="status" className="frame border border-line bg-ink-950 p-10">
        <p className="font-pixel text-uv-300">202 · ACCEPTED</p>
        <p className="font-display mt-4 text-2xl">{copy.success}</p>
      </div>
    );
  }

  const error = (field: ReviewField) => {
    const code = state.errors?.[field];
    return code ? copy[code] : null;
  };

  const fieldClass =
    "w-full border-0 border-b border-line-strong bg-transparent px-0 py-3 text-lg text-bone placeholder:text-fog/60 transition-colors focus:border-uv-400 focus:outline-none focus:ring-0 aria-[invalid=true]:border-red-400";

  return (
    <form action={action} noValidate className="flex flex-col gap-8">
      <h2 className="label">{copy.formTitle}</h2>

      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="startedAt" value={startedAt} />
      <div aria-hidden className="absolute -start-[9999px] h-px w-px overflow-hidden">
        <label>
          Company
          <input type="text" name="company" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <Field id="gameId" label={copy.game} error={error("game")}>
        <select
          id="gameId"
          name="gameId"
          required
          defaultValue={state.values?.game || defaultGameId || ""}
          aria-invalid={!!error("game")}
          className={cn(fieldClass, "[&>option]:bg-ink-950")}
        >
          <option value="">{copy.chooseGame}</option>
          {games.map((game) => (
            <option key={game.id} value={game.id}>
              {game.title}
            </option>
          ))}
        </select>
      </Field>

      <fieldset>
        <legend className="label">{copy.rating}</legend>
        <div className="mt-4 flex items-center gap-1" role="radiogroup" aria-label={copy.rating}>
          {[1, 2, 3, 4, 5].map((value) => (
            <label
              key={value}
              className="cursor-pointer p-1"
              title={`${value} ${value === 1 ? copy.star : copy.stars}`}
            >
              <input
                type="radio"
                name="rating"
                value={value}
                checked={rating === value}
                onChange={() => setRating(value)}
                className="sr-only"
              />
              <svg
                viewBox="0 0 24 24"
                aria-hidden
                className={cn(
                  "size-8 transition-colors",
                  value <= rating ? "text-uv-300" : "text-line-strong hover:text-uv-400/60",
                )}
              >
                <path
                  d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3-5.8 3 1.1-6.5L2.6 9.4l6.5-.9z"
                  fill={value <= rating ? "currentColor" : "none"}
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="sr-only">
                {value} {value === 1 ? copy.star : copy.stars}
              </span>
            </label>
          ))}
          <span className="ms-3 font-mono text-xs uppercase tracking-[0.14em] text-fog">
            {rating > 0 ? `${rating}/5` : copy.ratingHint}
          </span>
        </div>
        {error("rating") && <p className="mt-2 text-sm text-red-400">{error("rating")}</p>}
      </fieldset>

      <div className="grid gap-8 sm:grid-cols-2">
        <Field id="name" label={copy.name} error={error("name")}>
          <input
            id="name"
            name="name"
            autoComplete="name"
            required
            defaultValue={state.values?.name}
            aria-invalid={!!error("name")}
            className={fieldClass}
          />
        </Field>
        <Field id="email" label={copy.email} error={error("email")} hint={copy.emailHint}>
          <input
            id="email"
            name="email"
            type="email"
            dir="ltr"
            autoComplete="email"
            defaultValue={state.values?.email}
            aria-invalid={!!error("email")}
            className={fieldClass}
          />
        </Field>
      </div>

      <Field id="body" label={copy.review} error={error("body")}>
        <textarea
          id="body"
          name="body"
          rows={5}
          required
          placeholder={copy.reviewPlaceholder}
          defaultValue={state.values?.body}
          aria-invalid={!!error("body")}
          className={cn(fieldClass, "resize-y")}
        />
      </Field>

      <div className="flex flex-wrap items-center gap-6">
        <button
          type="submit"
          disabled={pending}
          data-magnetic
          className="inline-flex h-12 items-center gap-3 bg-bone px-6 font-mono text-[0.72rem] uppercase tracking-[0.14em] text-void transition-colors hover:bg-uv-500 hover:text-white disabled:opacity-60"
        >
          {pending ? copy.submitting : copy.submit}
        </button>
        <p className="text-xs text-fog">{copy.moderationNote}</p>
      </div>

      {state.status === "error" && !state.errors && (
        <p role="alert" className="text-sm text-red-400">
          {copy.error}
        </p>
      )}
    </form>
  );
}

function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error: string | null;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="label">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-sm text-red-400">{error}</p>
      ) : hint ? (
        <p className="text-xs text-fog">{hint}</p>
      ) : null}
    </div>
  );
}
