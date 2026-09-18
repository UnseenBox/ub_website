import "server-only";

import { revalidatePath, revalidateTag } from "next/cache";
import type {
  ContactMessage,
  Experience,
  Game,
  Review,
  ReviewStatus,
  Service,
  SiteSettings,
  StudioInfo,
} from "@/types/content";
import { importSeed } from "@/lib/db/client";
import { CONTENT_TAG, REVIEWS_TAG, SETTINGS_TAG, getContentFresh } from "./queries";
import { getStore } from "./store";

export { ContentConflictError } from "./store";

/**
 * Drops the cached copy of every public page after a write.
 *
 * `revalidateTag` — not `updateTag` — is what clears an `unstable_cache`
 * entry in a project without Cache Components; `updateTag` left the cached
 * content in place, so pages regenerated with the same stale data. The
 * "max" profile purges immediately rather than serving stale first.
 */
function invalidate() {
  revalidateTag(CONTENT_TAG, "max");
  revalidatePath("/", "layout");
}

async function write(operation: () => Promise<void>) {
  await operation();
  invalidate();
}

export async function saveGame(game: Game) {
  await write(() => getStore().saveGame(game));
}

export async function deleteGame(id: string) {
  await write(() => getStore().deleteGame(id));
}

export async function saveService(service: Service) {
  await write(() => getStore().saveService(service));
}

export async function deleteService(id: string) {
  await write(() => getStore().deleteService(id));
}

/** Swaps a service with its neighbour and renumbers the whole list. */
export async function moveService(id: string, direction: -1 | 1) {
  const services = [...(await getContentFresh()).services].sort((a, b) => a.order - b.order);
  const index = services.findIndex((service) => service.id === id);
  const target = index + direction;
  if (index === -1 || target < 0 || target >= services.length) return;
  [services[index], services[target]] = [services[target], services[index]];
  const renumbered = services.map((service, position) => ({ ...service, order: position + 1 }));
  await write(() => getStore().saveServices(renumbered));
}

export async function saveExperience(experience: Experience) {
  await write(() => getStore().saveExperience(experience));
}

export async function deleteExperience(id: string) {
  await write(() => getStore().deleteExperience(id));
}

export async function saveStudio(studio: StudioInfo) {
  await write(() => getStore().saveStudio(studio));
}

/**
 * Re-imports the built-in starter content. Every write is an upsert keyed by
 * id, so items you have edited are restored to their starter text and items
 * you added are left untouched — nothing is deleted.
 */
export async function restoreStarterContent() {
  if (getStore().kind !== "postgres") {
    throw new Error("Starter content can only be re-imported into a database. Locally, delete .data/content.json instead.");
  }
  await write(() => importSeed());
}

/* Site settings. The credentials stored alongside them are written by
   lib/auth/credentials.ts, which reads and writes the same row. */

export async function getSettings(): Promise<SiteSettings | null> {
  return getStore().readSettings();
}

/** Saves the site-wide options, leaving the stored credentials untouched. */
export async function saveSiteOptions(options: Pick<SiteSettings, "favicon" | "shareImage">) {
  const store = getStore();
  const current = (await store.readSettings()) ?? { updatedAt: new Date().toISOString() };
  await store.writeSettings({ ...current, ...options, updatedAt: new Date().toISOString() });
  revalidateTag(SETTINGS_TAG, "max");
  revalidatePath("/", "layout");
}

/* Messages are private and never part of the public cache. */

export async function listMessages(): Promise<ContactMessage[]> {
  return getStore().listMessages();
}

export async function addMessage(message: ContactMessage) {
  await getStore().addMessage(message);
}

export async function setMessageRead(id: string, read: boolean) {
  await getStore().setMessageRead(id, read);
}

export async function deleteMessage(id: string) {
  await getStore().deleteMessage(id);
}

/* Community reviews. New ones arrive pending, so nothing public changes
   until an admin approves them. */

export async function listReviews(status?: ReviewStatus): Promise<Review[]> {
  return getStore().listReviews(status);
}

export async function addReview(review: Review) {
  await getStore().addReview(review);
}

function invalidateReviews() {
  revalidateTag(REVIEWS_TAG, "max");
  revalidatePath("/", "layout");
}

export async function setReviewStatus(id: string, status: ReviewStatus) {
  await getStore().setReviewStatus(id, status);
  invalidateReviews();
}

export async function setReviewReply(id: string, reply: string) {
  await getStore().setReviewReply(id, reply);
  invalidateReviews();
}

export async function deleteReview(id: string) {
  await getStore().deleteReview(id);
  invalidateReviews();
}
