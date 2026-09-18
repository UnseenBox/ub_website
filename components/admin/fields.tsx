"use client";

import { useId, useState, type ReactNode } from "react";
import type { LocalizedString } from "@/types/content";
import { extractDriveId, resolveImageSrc } from "@/lib/images/drive";
import { SmartImage } from "@/components/ui/smart-image";
import { cn } from "@/lib/utils";

export const inputClass =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/25";

export function Card({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5 sm:p-6">
      <h2 className="font-semibold">{title}</h2>
      {description && <p className="mt-1 text-sm text-zinc-500">{description}</p>}
      <div className="mt-5 grid gap-5">{children}</div>
    </section>
  );
}

export function Field({
  label,
  hint,
  children,
  htmlFor,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-zinc-800">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-zinc-500">{hint}</p>}
    </div>
  );
}

export function TextInput({
  label,
  value,
  onChange,
  hint,
  placeholder,
  type = "text",
  dir,
}: {
  label: string;
  value: string | number | undefined;
  onChange: (value: string) => void;
  hint?: ReactNode;
  placeholder?: string;
  type?: string;
  dir?: "ltr" | "rtl";
}) {
  const id = useId();
  return (
    <Field label={label} hint={hint} htmlFor={id}>
      <input
        id={id}
        type={type}
        dir={dir}
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass}
      />
    </Field>
  );
}

export function SelectInput<T extends string>({
  label,
  value,
  options,
  onChange,
  hint,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  hint?: ReactNode;
}) {
  const id = useId();
  return (
    <Field label={label} hint={hint} htmlFor={id}>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value as T)} className={inputClass}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function Toggle({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 accent-violet-600"
      />
      <span>
        <span className="block text-sm font-medium text-zinc-800">{label}</span>
        {hint && <span className="block text-xs text-zinc-500">{hint}</span>}
      </span>
    </label>
  );
}

const LANGS = [
  { code: "en", label: "EN" },
  { code: "fr", label: "FR" },
  { code: "ar", label: "AR" },
] as const;

/** One field, three languages. Dots show which translations are filled in. */
export function LocalizedInput({
  label,
  value,
  onChange,
  multiline = false,
  rows = 4,
  hint,
  required,
}: {
  label: string;
  value: LocalizedString | undefined;
  onChange: (value: LocalizedString) => void;
  multiline?: boolean;
  rows?: number;
  hint?: ReactNode;
  required?: boolean;
}) {
  const [lang, setLang] = useState<"en" | "fr" | "ar">("en");
  const id = useId();
  const current = value ?? { en: "", fr: "", ar: "" };
  const common = {
    id,
    dir: lang === "ar" ? ("rtl" as const) : ("ltr" as const),
    lang,
    value: current[lang],
    onChange: (e: { target: { value: string } }) => onChange({ ...current, [lang]: e.target.value }),
    className: cn(inputClass, lang === "ar" && "font-[system-ui] text-base"),
  };

  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-zinc-800">
          {label}
          {required && <span className="text-violet-600"> *</span>}
        </label>
        <div role="tablist" aria-label={`${label} language`} className="flex rounded-md bg-zinc-100 p-0.5">
          {LANGS.map((l) => (
            <button
              key={l.code}
              type="button"
              role="tab"
              aria-selected={lang === l.code}
              onClick={() => setLang(l.code)}
              className={cn(
                "flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium",
                lang === l.code ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-800",
              )}
            >
              <span
                aria-hidden
                className={cn("size-1.5 rounded-full", current[l.code].trim() ? "bg-emerald-500" : "bg-zinc-300")}
              />
              {l.label}
            </button>
          ))}
        </div>
      </div>
      {multiline ? <textarea rows={rows} {...common} /> : <input type="text" {...common} />}
      {hint && <p className="text-xs text-zinc-500">{hint}</p>}
    </div>
  );
}

/** Image reference input: upload a file, or paste a Drive/URL link. */
export function ImageField({
  label,
  value,
  onChange,
  aspect = "aspect-video",
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  aspect?: string;
  hint?: string;
}) {
  const id = useId();
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const resolved = resolveImageSrc(value);
  const drive = value ? extractDriveId(value) : null;
  const invalid = value.trim() !== "" && !resolved;

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    try {
      // Sent straight from the browser to Blob storage, so large images are
      // not limited by the serverless request size.
      const { upload } = await import("@vercel/blob/client");
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/admin/upload",
        contentType: file.type,
      });
      onChange(blob.url);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="grid gap-3 sm:grid-cols-[1fr_9rem]">
      <Field
        label={label}
        htmlFor={id}
        hint={
          uploadError ? (
            <span className="text-red-600">{uploadError}</span>
          ) : invalid ? (
            <span className="text-red-600">Not a usable image reference.</span>
          ) : drive ? (
            <span className="text-emerald-700">Google Drive file detected ✓ — make sure it is shared with “Anyone with the link”.</span>
          ) : (
            hint ?? "Upload a file, or paste a Google Drive link, a https:// URL or a /media/ path."
          )
        }
      >
        <input
          id={id}
          dir="ltr"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://drive.google.com/file/d/…/view"
          className={cn(inputClass, invalid && "border-red-400")}
        />
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <label
            className={cn(
              "cursor-pointer rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:border-violet-400",
              uploading && "pointer-events-none opacity-60",
            )}
          >
            {uploading ? "Uploading…" : "Upload image"}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              disabled={uploading}
              onChange={(e) => {
                void handleFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
          {value && (
            <button
              type="button"
              onClick={() => onChange("")}
              className="text-sm text-zinc-500 hover:text-red-600"
            >
              Clear
            </button>
          )}
        </div>
      </Field>
      <div className={cn("relative overflow-hidden rounded-md border border-zinc-200 bg-zinc-100", aspect)}>
        {resolved ? (
          <SmartImage key={resolved} src={value} alt="" sizes="9rem" />
        ) : (
          <span className="absolute inset-0 grid place-items-center text-xs text-zinc-400">No image</span>
        )}
      </div>
    </div>
  );
}

/** Generic repeatable list with add / remove / reorder. */
export function ListEditor<T>({
  label,
  items,
  onChange,
  create,
  render,
  addLabel = "Add",
  hint,
}: {
  label: string;
  items: T[];
  onChange: (items: T[]) => void;
  create: () => T;
  render: (item: T, update: (item: T) => void, index: number) => ReactNode;
  addLabel?: string;
  hint?: string;
}) {
  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <div className="grid gap-3">
      <div>
        <p className="text-sm font-medium text-zinc-800">{label}</p>
        {hint && <p className="text-xs text-zinc-500">{hint}</p>}
      </div>
      {items.length === 0 && <p className="rounded-md border border-dashed border-zinc-300 p-4 text-sm text-zinc-500">Nothing here yet.</p>}
      <ol className="grid gap-3">
        {items.map((item, index) => (
          <li key={index} className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-500">#{index + 1}</span>
              <div className="flex gap-1">
                <IconButton label="Move up" onClick={() => move(index, -1)} disabled={index === 0}>↑</IconButton>
                <IconButton label="Move down" onClick={() => move(index, 1)} disabled={index === items.length - 1}>↓</IconButton>
                <IconButton label="Remove" onClick={() => onChange(items.filter((_, i) => i !== index))} danger>
                  ✕
                </IconButton>
              </div>
            </div>
            {render(item, (value) => onChange(items.map((entry, i) => (i === index ? value : entry))), index)}
          </li>
        ))}
      </ol>
      <div>
        <button
          type="button"
          onClick={() => onChange([...items, create()])}
          className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium hover:border-violet-500 hover:text-violet-700"
        >
          + {addLabel}
        </button>
      </div>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "grid size-7 place-items-center rounded border border-zinc-200 bg-white text-xs disabled:opacity-30",
        danger ? "hover:border-red-400 hover:text-red-600" : "hover:border-violet-400",
      )}
    >
      {children}
    </button>
  );
}
