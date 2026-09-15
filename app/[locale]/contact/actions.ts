"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { getStore } from "@/lib/content/store";
import { isLocale } from "@/lib/i18n/config";
import { newId } from "@/lib/utils";

export type ContactField = "name" | "email" | "topic" | "message";
export type ContactErrorCode = "required" | "invalidEmail" | "tooShort";

export interface ContactState {
  status: "idle" | "success" | "error";
  errors?: Partial<Record<ContactField, ContactErrorCode>>;
  values?: Partial<Record<ContactField, string>>;
}

export const TOPICS = ["game", "education", "xr", "installation", "press", "other"] as const;

const schema = z.object({
  name: z.string().trim().min(1, "required").max(120),
  email: z.string().trim().min(1, "required").max(200).pipe(z.email("invalidEmail")),
  topic: z.enum(TOPICS, "required"),
  message: z.string().trim().min(1, "required").min(20, "tooShort").max(5000),
});

const hits = new Map<string, number[]>();
function limited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 10 * 60 * 1000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 5;
}

export async function submitContact(_prev: ContactState, formData: FormData): Promise<ContactState> {
  const values = {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    topic: String(formData.get("topic") ?? ""),
    message: String(formData.get("message") ?? ""),
  };

  // Bots: honeypot filled, or submitted faster than a human could type.
  const honeypot = String(formData.get("company") ?? "");
  const startedAt = Number(formData.get("startedAt") ?? 0);
  if (honeypot || (startedAt && Date.now() - startedAt < 2500)) {
    return { status: "success" };
  }

  const parsed = schema.safeParse(values);
  if (!parsed.success) {
    const errors: ContactState["errors"] = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as ContactField;
      if (!errors[field]) {
        errors[field] = (["required", "invalidEmail", "tooShort"].includes(issue.message)
          ? issue.message
          : "required") as ContactErrorCode;
      }
    }
    return { status: "error", errors, values };
  }

  const requestHeaders = await headers();
  const ip = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (limited(ip)) return { status: "error", values };

  const localeValue = String(formData.get("locale") ?? "en");
  try {
    const store = getStore();
    const messages = await store.readMessages();
    messages.unshift({
      id: newId("msg"),
      ...parsed.data,
      locale: isLocale(localeValue) ? localeValue : "en",
      createdAt: new Date().toISOString(),
      read: false,
    });
    await store.writeMessages(messages.slice(0, 1000));
    return { status: "success" };
  } catch (error) {
    console.error("[contact] Failed to store message:", error);
    return { status: "error", values };
  }
}
