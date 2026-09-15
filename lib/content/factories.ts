import type { Experience, Game, LocalizedString, Service } from "@/types/content";
import { newId } from "@/lib/utils";

export const emptyLocalized = (): LocalizedString => ({ en: "", fr: "", ar: "" });

export function newGame(order: number): Game {
  return {
    id: newId("game"),
    slug: "",
    title: "",
    tagline: emptyLocalized(),
    summary: emptyLocalized(),
    description: emptyLocalized(),
    genre: emptyLocalized(),
    platforms: [],
    status: "released",
    releaseDate: "",
    estimatedRelease: emptyLocalized(),
    progress: 0,
    poster: "",
    cover: "",
    screenshots: [],
    trailerUrl: "",
    links: [],
    features: [],
    devNotes: [],
    engine: "",
    accent: "#8f5bff",
    featured: false,
    upcoming: false,
    order,
    updatedAt: new Date().toISOString(),
  };
}

export function newService(order: number): Service {
  return {
    id: newId("svc"),
    title: emptyLocalized(),
    kicker: emptyLocalized(),
    description: emptyLocalized(),
    deliverables: [],
    glyph: "cube",
    order,
  };
}

export function newExperience(order: number): Experience {
  return {
    id: newId("exp"),
    slug: "",
    title: emptyLocalized(),
    type: "client",
    date: new Date().toISOString().slice(0, 7),
    location: emptyLocalized(),
    client: "",
    summary: emptyLocalized(),
    body: emptyLocalized(),
    cover: "",
    images: [],
    link: "",
    order,
  };
}
