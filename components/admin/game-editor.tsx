"use client";

import { useState } from "react";
import { deleteGameAction, saveGameAction } from "@/app/admin/actions";
import { emptyLocalized } from "@/lib/content/factories";
import { cn, newId, slugify } from "@/lib/utils";
import { GAME_STATUSES, LINK_KINDS, PLATFORMS, type Game } from "@/types/content";
import { EditorShell } from "./editor-shell";
import { Card, ImageField, ListEditor, LocalizedInput, SelectInput, TextInput, Toggle, inputClass } from "./fields";

const STATUS_LABELS: Record<string, string> = {
  released: "Released",
  "early-access": "Early access",
  beta: "Beta",
  alpha: "Alpha",
  production: "In production",
  prototype: "Prototype",
  concept: "Concept",
};

const PLATFORM_LABELS: Record<string, string> = {
  pc: "PC", mac: "Mac", linux: "Linux", web: "Web", ios: "iOS", android: "Android", switch: "Switch",
  playstation: "PlayStation", xbox: "Xbox", quest: "Meta Quest", steamvr: "SteamVR", visionpro: "Vision Pro",
};

const LINK_LABELS: Record<string, string> = {
  steam: "Steam", itch: "itch.io", googlePlay: "Google Play", appStore: "App Store", website: "Website",
  discord: "Discord", epic: "Epic Games", nintendo: "Nintendo eShop", playstation: "PlayStation Store",
  xbox: "Xbox Store", meta: "Meta Store", press: "Press kit", other: "Other",
};

export function GameEditor({ initial, isNew }: { initial: Game; isNew: boolean }) {
  const [game, setGame] = useState<Game>(initial);
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const set = <K extends keyof Game>(key: K, value: Game[K]) => setGame((g) => ({ ...g, [key]: value }));

  return (
    <EditorShell
      title={isNew ? "New game" : game.title || "Untitled game"}
      backHref="/admin/games"
      backLabel="Games"
      viewHref={isNew ? undefined : `/en/games/${initial.slug}`}
      onSave={() => saveGameAction(game)}
      onDelete={isNew ? undefined : () => deleteGameAction(game.id)}
      afterSaveHref={isNew ? `/admin/games/${game.id}` : undefined}
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
            hint={`/en/games/${game.slug || "…"}`}
            onChange={(slug) => {
              setSlugTouched(true);
              set("slug", slugify(slug));
            }}
          />
          <SelectInput
            label="Status"
            value={game.status}
            options={GAME_STATUSES.map((value) => ({ value, label: STATUS_LABELS[value] }))}
            onChange={(status) => set("status", status)}
          />
          <TextInput label="Display order" type="number" value={game.order} onChange={(v) => set("order", Number(v) || 0)} hint="Lower numbers appear first." />
          <TextInput label="Engine" value={game.engine} onChange={(v) => set("engine", v)} placeholder="Unity, Godot, Unreal…" />
          <div className="grid gap-1.5">
            <span className="text-sm font-medium text-zinc-800">Accent colour</span>
            <div className="flex gap-2">
              <input
                type="color"
                aria-label="Accent colour picker"
                value={game.accent || "#8f5bff"}
                onChange={(e) => set("accent", e.target.value)}
                className="h-9 w-12 cursor-pointer rounded border border-zinc-300"
              />
              <input aria-label="Accent colour hex" value={game.accent ?? ""} onChange={(e) => set("accent", e.target.value)} className={inputClass} dir="ltr" />
            </div>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Toggle label="Featured" checked={game.featured} onChange={(v) => set("featured", v)} hint="Shown first in the home page showcase." />
          <Toggle label="Upcoming / in development" checked={game.upcoming} onChange={(v) => set("upcoming", v)} hint="Moves the game to “In the dark” with progress and dev notes." />
        </div>
      </Card>

      <Card title="Text" description="English is required; French and Arabic fall back to English when empty.">
        <LocalizedInput label="Tagline" required value={game.tagline} onChange={(v) => set("tagline", v)} />
        <LocalizedInput label="Short description" required multiline rows={3} value={game.summary} onChange={(v) => set("summary", v)} />
        <LocalizedInput label="Full description" multiline rows={8} value={game.description} onChange={(v) => set("description", v)} hint="Separate paragraphs with an empty line." />
        <LocalizedInput label="Genre" value={game.genre} onChange={(v) => set("genre", v)} />
      </Card>

      <Card title="Release">
        {game.upcoming ? (
          <div className="grid gap-5 sm:grid-cols-2">
            <LocalizedInput label="Estimated release" value={game.estimatedRelease} onChange={(v) => set("estimatedRelease", v)} hint="Free text, e.g. “Autumn 2027”." />
            <TextInput label="Development progress (%)" type="number" value={game.progress ?? 0} onChange={(v) => set("progress", Math.max(0, Math.min(100, Number(v) || 0)))} />
          </div>
        ) : (
          <TextInput label="Release date" type="date" value={game.releaseDate} onChange={(v) => set("releaseDate", v)} />
        )}
        <fieldset>
          <legend className="text-sm font-medium text-zinc-800">Platforms</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {PLATFORMS.map((platform) => {
              const checked = game.platforms.includes(platform);
              return (
                <label
                  key={platform}
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
                      set("platforms", checked ? game.platforms.filter((p) => p !== platform) : [...game.platforms, platform])
                    }
                  />
                  {PLATFORM_LABELS[platform]}
                </label>
              );
            })}
          </div>
        </fieldset>
      </Card>

      <Card title="Media" description="Images can live in Google Drive — paste the share link. Changes appear without redeploying.">
        <ImageField label="Poster (portrait 2:3)" value={game.poster} onChange={(v) => set("poster", v)} aspect="aspect-[2/3]" />
        <ImageField label="Cover / key art (wide)" value={game.cover} onChange={(v) => set("cover", v)} />
        <TextInput label="Trailer URL" value={game.trailerUrl} dir="ltr" onChange={(v) => set("trailerUrl", v)} hint="YouTube, Vimeo or a direct .mp4 link." />
        <ListEditor
          label="Screenshots"
          items={game.screenshots}
          onChange={(v) => set("screenshots", v)}
          create={() => ""}
          addLabel="Add screenshot"
          render={(value, update, i) => <ImageField label={`Screenshot ${i + 1}`} value={value} onChange={update} />}
        />
      </Card>

      <Card title="Links" description="Only links you add are shown. The first store link becomes the primary button.">
        <ListEditor
          label="Store & community links"
          items={game.links}
          onChange={(v) => set("links", v)}
          create={() => ({ kind: "steam" as const, url: "" })}
          addLabel="Add link"
          render={(link, update) => (
            <div className="grid gap-3 sm:grid-cols-[10rem_1fr_10rem]">
              <SelectInput
                label="Type"
                value={link.kind}
                options={LINK_KINDS.map((value) => ({ value, label: LINK_LABELS[value] }))}
                onChange={(kind) => update({ ...link, kind })}
              />
              <TextInput label="URL" value={link.url} dir="ltr" onChange={(url) => update({ ...link, url })} placeholder="https://" />
              <TextInput label="Custom label" value={link.label} onChange={(label) => update({ ...link, label })} placeholder="Optional" />
            </div>
          )}
        />
      </Card>

      <Card title="Features">
        <ListEditor
          label="Key features"
          items={game.features}
          onChange={(v) => set("features", v)}
          create={emptyLocalized}
          addLabel="Add feature"
          render={(feature, update) => <LocalizedInput label="Feature" value={feature} onChange={update} />}
        />
      </Card>

      {game.upcoming && (
        <Card title="Development notes" description="Short dated logs. The newest appears on the upcoming page.">
          <ListEditor
            label="Dev log"
            items={game.devNotes}
            onChange={(v) => set("devNotes", v)}
            create={() => ({ id: newId("note"), date: new Date().toISOString().slice(0, 10), text: emptyLocalized() })}
            addLabel="Add note"
            render={(note, update) => (
              <div className="grid gap-3">
                <TextInput label="Date" type="date" value={note.date} onChange={(date) => update({ ...note, date })} />
                <LocalizedInput label="Note" multiline rows={3} value={note.text} onChange={(text) => update({ ...note, text })} />
              </div>
            )}
          />
        </Card>
      )}
    </EditorShell>
  );
}
