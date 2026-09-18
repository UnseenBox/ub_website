"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { addReview } from "@/lib/content/mutations";
import { getContent } from "@/lib/content/queries";
import { isLocale } from "@/lib/i18n/config";
import { newId } from "@/lib/utils";

export type ReviewField = "game" | "rating" | "name" | "email" | "body";
export type ReviewErrorCode = "required" | "invalidEmail" | "tooShort" | "noRating";

export interface ReviewState {
  status: "idle" | "success" | "error";
  errors?: Partial<Record<ReviewField, ReviewErrorCode>>;
  values?: Partial<Record<ReviewField, string>>;
}

const schema = z.object({
  gameId: z.string().trim().min(1, "required").max(80),
  rating: z.coerce.number("noRating").int("noRating").min(1, "noRating").max(5, "noRating"),
  name: z.string().trim().min(1, "required").max(60),
  email: z.union([z.literal(""), z.string().trim().max(200).pipe(z.email("invalidEmail"))]),
  body: z.string().trim().min(1, "required").min(15, "tooShort").max(2000),
});

/** Same shape of defence as the contact form: honeypot, timing, per-IP cap. */
const hits = new Map<string, number[]>();
function limited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((time) => now - time < 60 * 60 * 1000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 5;
}

export async function submitReview(_prev: ReviewState, formData: FormData): Promise<ReviewState> {
  const values = {
    game: String(formData.get("gameId") ?? ""),
    rating: String(formData.get("rating") ?? ""),
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    body: String(formData.get("body") ?? ""),
  };

  const honeypot = String(formData.get("company") ?? "");
  const startedAt = Number(formData.get("startedAt") ?? 0);
  if (honeypot || (startedAt && Date.now() - startedAt < 2500)) {
    return { status: "success" };
  }

  const parsed = schema.safeParse({
    gameId: values.game,
    rating: values.rating,
    name: values.name,
    email: values.email,
    body: values.body,
  });

  if (!parsed.success) {
    const errors: ReviewState["errors"] = {};
    const fieldOf: Record<string, ReviewField> = {
      gameId: "game",
      rating: "rating",
      name: "name",
      email: "email",
      body: "body",
    };
    for (const issue of parsed.error.issues) {
      const field = fieldOf[String(issue.path[0])];
      if (!field || errors[field]) continue;
      errors[field] = (["required", "invalidEmail", "tooShort", "noRating"].includes(issue.message)
        ? issue.message
        : "required") as ReviewErrorCode;
    }
    return { status: "error", errors, values };
  }

  const requestHeaders = await headers();
  const ip = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (limited(ip)) return { status: "error", values };

  const localeValue = String(formData.get("locale") ?? "en");
  try {
    // Reviews name the game they belong to, so they stay readable even if the
    // game is later renamed or removed.
    const game = (await getContent()).games.find((entry) => entry.id === parsed.data.gameId);
    if (!game) return { status: "error", errors: { game: "required" }, values };

    await addReview({
      id: newId("rev"),
      gameId: game.id,
      gameSlug: game.slug,
      gameTitle: game.title,
      name: parsed.data.name,
      email: parsed.data.email || undefined,
      rating: parsed.data.rating,
      body: parsed.data.body,
      locale: isLocale(localeValue) ? localeValue : "en",
      status: "pending",
      createdAt: new Date().toISOString(),
    });
    return { status: "success" };
  } catch (error) {
    console.error("[community] Failed to store review:", error);
    return { status: "error", values };
  }
}
