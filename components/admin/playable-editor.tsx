"use client";

import { useState } from "react";
import { deletePlayableAction, savePlayableAction } from "@/app/admin/actions";
import { cn, slugify } from "@/lib/utils";
import { PLAY_MOODS, type Playable, type PlayMood } from "@/types/content";
import { EditorShell } from "./editor-shell";
import { Card, ImageField, LocalizedInput, TextInput, Toggle } from "./fields";

const MOOD_LABELS: Record<PlayMood, string> = {
  quick: "Quick fix",
  brain: "Brain teasers",
  chaos: "Pure chaos",
  friends: "With a friend",
  dark: "Lights off",
  phone: "Phone friendly",
};

export function PlayableEditor({ initial, isNew }: { initial: Playable; isNew: boolean }) {
  const [game, setGame] = useState<Playable>(initial);
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const set = <K extends keyof Playable>(key: K, value: Playable[K]) => setGame((g) => ({ ...g, [key]: value }));

  return (
    <EditorShell
      title={isNew ? "New arcade game" : game.title || "Untitled arcade game"}
      backHref="/admin/playables"
      backLabel="Arcade"
      viewHref={isNew ? undefined : `/en/play/${initial.slug}`}
      onSave={() => savePlayableAction(game)}
      onDelete={isNew ? undefined : () => deletePlayableAction(game.id)}
      afterSaveHref={isNew ? `/admin/playables/${game.id}` : undefined}
    >
      <Card title="Basics">
        <div className="grid gap-5 sm:grid-cols-2">
          <TextInput
            label="Title *"
            value={game.title}
            onChange={(title) => setGame((g) => ({ ...g, title, slug: slugTouched ? g.slug : slugify(title) }))}
          />
          <TextInput
            label="URL slug *"
            value={game.slug}
            dir="ltr"
            hint={`/en/play/${game.slug || "…"}`}
            onChange={(slug) => {
              setSlugTouched(true);
              set("slug", slugify(slug));
            }}
          />
          <TextInput label="Date added" type="date" value={game.added} onChange={(v) => set("added", v)} hint="The latest game wears the “New” badge." />
          <TextInput label="Display order" type="number" value={game.order} onChange={(v) => set("order", Number(v) || 0)} hint="Lower numbers appear first." />
        </div>
        <Toggle
          label="Playable"
          checked={game.enabled}
          onChange={(v) => set("enabled", v)}
          hint="When switched off, the game disappears from the arcade, search and reviews."
        />
        <fieldset>
          <legend className="text-sm font-medium text-zinc-800">Moods</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {PLAY_MOODS.map((mood) => {
              const checked = game.moods.includes(mood);
              return (
                <label
                  key={mood}
                  className={cn(
                    "cursor-pointer rounded-md border px-3 py-1.5 text-sm",
                    checked ? "border-violet-500 bg-violet-50 text-violet-800" : "border-zinc-300 hover:border-zinc-400",
                  )}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={checked}
                    onChange={() =>
                      set("moods", checked ? game.moods.filter((m) => m !== mood) : [...game.moods, mood])
                    }
                  />
                  {MOOD_LABELS[mood]}
                </label>
              );
            })}
          </div>
        </fieldset>
      </Card>

      <Card
        title="Game files"
        description="The game itself is a static build. Copy its folder to public/arcade/<slug>/ (with a poster.jpg), redeploy, then point the entry below at it."
      >
        <TextInput
          label="Entry point *"
          value={game.src}
          dir="ltr"
          onChange={(v) => set("src", v)}
          placeholder="/arcade/my-game/index.html"
          hint="Must keep its file extension so the site serves it as a file, e.g. /arcade/my-game/index.html."
        />
        <ImageField label="Poster / tile image" value={game.poster} onChange={(v) => set("poster", v)} />
      </Card>

      <Card title="Text" description="English is required where marked; French and Arabic fall back to English when empty.">
        <LocalizedInput label="Genre" value={game.genre} onChange={(v) => set("genre", v)} />
        <LocalizedInput label="Summary *" required multiline rows={6} value={game.summary} onChange={(v) => set("summary", v)} />
        <LocalizedInput label="Desktop controls" multiline rows={2} value={game.desktopControls} onChange={(v) => set("desktopControls", v)} />
        <LocalizedInput label="Phone controls" multiline rows={2} value={game.phoneControls} onChange={(v) => set("phoneControls", v)} />
      </Card>
    </EditorShell>
  );
}
