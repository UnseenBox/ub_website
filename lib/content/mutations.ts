import "server-only";

import { revalidatePath, updateTag } from "next/cache";
import type { ContactMessage, Experience, Game, Service, SiteContent, StudioInfo } from "@/types/content";
import { CONTENT_TAG, getContentFresh } from "./queries";
import { getStore } from "./store";

export class ContentConflictError extends Error {}

/** Read → mutate → write → invalidate every public page. */
async function update(mutator: (content: SiteContent) => void | Promise<void>) {
  const content = await getContentFresh();
  await mutator(content);
  content.updatedAt = new Date().toISOString();
  content.version = (content.version ?? 0) + 1;
  await getStore().writeContent(content);
  updateTag(CONTENT_TAG);
  revalidatePath("/", "layout");
}

const upsert = <T extends { id: string }>(list: T[], item: T) => {
  const index = list.findIndex((entry) => entry.id === item.id);
  if (index === -1) list.push(item);
  else list[index] = item;
};

export async function saveGame(game: Game) {
  await update((content) => {
    if (content.games.some((g) => g.slug === game.slug && g.id !== game.id)) {
      throw new ContentConflictError(`Another game already uses the slug "${game.slug}".`);
    }
    upsert(content.games, { ...game, updatedAt: new Date().toISOString() });
  });
}

export async function deleteGame(id: string) {
  await update((content) => {
    content.games = content.games.filter((g) => g.id !== id);
  });
}

export async function saveService(service: Service) {
  await update((content) => upsert(content.services, service));
}

export async function deleteService(id: string) {
  await update((content) => {
    content.services = content.services.filter((s) => s.id !== id);
  });
}

export async function moveService(id: string, direction: -1 | 1) {
  await update((content) => {
    const sorted = [...content.services].sort((a, b) => a.order - b.order);
    const index = sorted.findIndex((s) => s.id === id);
    const target = index + direction;
    if (index === -1 || target < 0 || target >= sorted.length) return;
    [sorted[index], sorted[target]] = [sorted[target], sorted[index]];
    content.services = sorted.map((service, i) => ({ ...service, order: i + 1 }));
  });
}

export async function saveExperience(experience: Experience) {
  await update((content) => {
    if (content.experiences.some((e) => e.slug === experience.slug && e.id !== experience.id)) {
      throw new ContentConflictError(`Another entry already uses the slug "${experience.slug}".`);
    }
    upsert(content.experiences, experience);
  });
}

export async function deleteExperience(id: string) {
  await update((content) => {
    content.experiences = content.experiences.filter((e) => e.id !== id);
  });
}

export async function saveStudio(studio: StudioInfo) {
  await update((content) => {
    content.studio = studio;
  });
}

/* Messages are private and never part of the public cache. */

export async function listMessages(): Promise<ContactMessage[]> {
  return getStore().readMessages();
}

export async function setMessageRead(id: string, read: boolean) {
  const store = getStore();
  const messages = await store.readMessages();
  await store.writeMessages(messages.map((m) => (m.id === id ? { ...m, read } : m)));
}

export async function deleteMessage(id: string) {
  const store = getStore();
  const messages = await store.readMessages();
  await store.writeMessages(messages.filter((m) => m.id !== id));
}
