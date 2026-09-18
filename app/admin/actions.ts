"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  adminConfigured,
  checkCredentials,
  clearAttempts,
  isThrottled,
  recordFailedAttempt,
  requireAdmin,
} from "@/lib/auth/guard";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, createSessionToken, getSessionSecret } from "@/lib/auth/session";
import { StorageNotConfiguredError } from "@/lib/content/store";
import * as mutations from "@/lib/content/mutations";
import { saveCredentials } from "@/lib/auth/credentials";
import {
  experienceSchema,
  formatIssues,
  gameSchema,
  serviceSchema,
  siteOptionsSchema,
  studioSchema,
} from "@/lib/validation/schemas";
import type { Experience, Game, ReviewStatus, Service, StudioInfo } from "@/types/content";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string; issues?: string[] };

function failure(error: unknown): ActionResult {
  if (error instanceof StorageNotConfiguredError || error instanceof mutations.ContentConflictError) {
    return { ok: false, error: error.message };
  }
  console.error("[admin] action failed:", error);
  return { ok: false, error: "Something went wrong while saving. Check the server logs." };
}

/* ------------------------------------------------------------------ auth */

export interface LoginState {
  error?: string;
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  if (!(await adminConfigured())) return { error: "Admin credentials are not configured on the server." };
  if (!getSessionSecret()) return { error: "ADMIN_SESSION_SECRET is missing (32+ characters required in production)." };

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (isThrottled(ip)) return { error: "Too many attempts. Try again in a few minutes." };

  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!(await checkCredentials(username, password))) {
    recordFailedAttempt(ip);
    await new Promise((resolve) => setTimeout(resolve, 600));
    return { error: "Invalid username or password." };
  }

  clearAttempts(ip);
  const token = await createSessionToken(username);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  redirect("/admin");
}

export async function logoutAction() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/admin/login");
}

/* ------------------------------------------------------------------ games */

export async function saveGameAction(input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = gameSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please fix the highlighted problems.", issues: formatIssues(parsed.error) };
  try {
    await mutations.saveGame({ ...parsed.data, updatedAt: new Date().toISOString() } as Game);
    return { ok: true, message: "Game saved." };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteGameAction(id: string): Promise<ActionResult> {
  await requireAdmin();
  try {
    await mutations.deleteGame(id);
    return { ok: true, message: "Game deleted." };
  } catch (error) {
    return failure(error);
  }
}

/* ------------------------------------------------------------------ services */

export async function saveServiceAction(input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = serviceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please fix the highlighted problems.", issues: formatIssues(parsed.error) };
  try {
    await mutations.saveService(parsed.data as Service);
    return { ok: true, message: "Service saved." };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteServiceAction(id: string): Promise<ActionResult> {
  await requireAdmin();
  try {
    await mutations.deleteService(id);
    return { ok: true, message: "Service deleted." };
  } catch (error) {
    return failure(error);
  }
}

export async function moveServiceAction(id: string, direction: -1 | 1): Promise<ActionResult> {
  await requireAdmin();
  try {
    await mutations.moveService(id, direction === -1 ? -1 : 1);
    revalidatePath("/admin/services");
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

/* ------------------------------------------------------------------ experiences */

export async function saveExperienceAction(input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = experienceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please fix the highlighted problems.", issues: formatIssues(parsed.error) };
  try {
    await mutations.saveExperience(parsed.data as Experience);
    return { ok: true, message: "Entry saved." };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteExperienceAction(id: string): Promise<ActionResult> {
  await requireAdmin();
  try {
    await mutations.deleteExperience(id);
    return { ok: true, message: "Entry deleted." };
  } catch (error) {
    return failure(error);
  }
}

/* ------------------------------------------------------------------ studio */

export async function saveStudioAction(input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = studioSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please fix the highlighted problems.", issues: formatIssues(parsed.error) };
  try {
    await mutations.saveStudio(parsed.data as StudioInfo);
    return { ok: true, message: "Studio information saved." };
  } catch (error) {
    return failure(error);
  }
}

/* ------------------------------------------------------------------ messages */

export async function setMessageReadAction(id: string, read: boolean): Promise<ActionResult> {
  await requireAdmin();
  try {
    await mutations.setMessageRead(id, read);
    revalidatePath("/admin/messages");
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteMessageAction(id: string): Promise<ActionResult> {
  await requireAdmin();
  try {
    await mutations.deleteMessage(id);
    revalidatePath("/admin/messages");
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function restoreStarterContentAction(): Promise<ActionResult> {
  await requireAdmin();
  try {
    await mutations.restoreStarterContent();
    revalidatePath("/admin", "layout");
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

/* ------------------------------------------------------------------ reviews */

export async function setReviewStatusAction(id: string, status: ReviewStatus): Promise<ActionResult> {
  await requireAdmin();
  try {
    await mutations.setReviewStatus(id, status);
    revalidatePath("/admin/reviews");
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function replyToReviewAction(id: string, reply: string): Promise<ActionResult> {
  await requireAdmin();
  try {
    await mutations.setReviewReply(id, reply.trim().slice(0, 1000));
    revalidatePath("/admin/reviews");
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteReviewAction(id: string): Promise<ActionResult> {
  await requireAdmin();
  try {
    await mutations.deleteReview(id);
    revalidatePath("/admin/reviews");
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

/* ------------------------------------------------------------------ settings */

export async function saveSiteOptionsAction(options: { favicon: string; shareImage: string }): Promise<ActionResult> {
  await requireAdmin();
  try {
    const parsed = siteOptionsSchema.safeParse(options);
    if (!parsed.success) return { ok: false, error: formatIssues(parsed.error).join("\n") };
    await mutations.saveSiteOptions(parsed.data);
    revalidatePath("/admin/settings");
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

/**
 * Changes the admin username and/or password. The current password is always
 * required, so a borrowed open session cannot lock the owner out.
 */
export async function updateAccountAction(input: {
  currentPassword: string;
  username: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<ActionResult> {
  const session = await requireAdmin();
  try {
    const username = input.username.trim();
    if (username.length < 3) return { ok: false, error: "The username needs at least 3 characters." };
    if (!(await checkCredentials(session.sub, input.currentPassword))) {
      await new Promise((resolve) => setTimeout(resolve, 600));
      return { ok: false, error: "That is not your current password." };
    }
    if (input.newPassword || input.confirmPassword) {
      if (input.newPassword.length < 12) {
        return { ok: false, error: "The new password needs at least 12 characters." };
      }
      if (input.newPassword !== input.confirmPassword) {
        return { ok: false, error: "The two new passwords do not match." };
      }
    }

    await saveCredentials(username, input.newPassword || undefined);

    // The session names the old username, so re-issue it rather than
    // signing the admin out mid-edit.
    const token = await createSessionToken(username);
    (await cookies()).set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_TTL_SECONDS,
    });
    revalidatePath("/admin", "layout");
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}
