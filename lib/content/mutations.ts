import "server-only";

import { revalidatePath, updateTag } from "next/cache";
import type { ContactMessage, Experience, Game, Service, StudioInfo } from "@/types/content";
import { CONTENT_TAG, getContentFresh } from "./queries";
import { getStore } from "./store";

export { ContentConflictError } from "./store";

/** Drops the cached copy of every public page after a write. */
function invalidate() {
  updateTag(CONTENT_TAG);
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
