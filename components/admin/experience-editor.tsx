"use client";

import { useState } from "react";
import { deleteExperienceAction, saveExperienceAction } from "@/app/admin/actions";
import { slugify } from "@/lib/utils";
import { EXPERIENCE_TYPES, type Experience } from "@/types/content";
import { EditorShell } from "./editor-shell";
import { Card, ImageField, ListEditor, LocalizedInput, SelectInput, TextInput } from "./fields";

const TYPE_LABELS: Record<string, string> = {
  client: "Client project",
  installation: "Installation",
  event: "Event",
  experiment: "Experiment",
  education: "Education",
  "behind-the-scenes": "Behind the scenes",
};

export function ExperienceEditor({ initial, isNew }: { initial: Experience; isNew: boolean }) {
  const [item, setItem] = useState<Experience>(initial);
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const set = <K extends keyof Experience>(key: K, value: Experience[K]) => setItem((e) => ({ ...e, [key]: value }));

  return (
    <EditorShell
      title={isNew ? "New archive entry" : item.title.en || "Untitled entry"}
      backHref="/admin/experiences"
      backLabel="Archive"
      viewHref={isNew ? undefined : `/en/experiences/${initial.slug}`}
      onSave={() => saveExperienceAction(item)}
      onDelete={isNew ? undefined : () => deleteExperienceAction(item.id)}
      afterSaveHref={isNew ? `/admin/experiences/${item.id}` : undefined}
    >
      <Card title="Basics">
        <LocalizedInput
          label="Title"
          required
          value={item.title}
          onChange={(title) => setItem((e) => ({ ...e, title, slug: slugTouched ? e.slug : slugify(title.en) }))}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <TextInput
            label="URL slug *"
            value={item.slug}
            dir="ltr"
            hint={`/en/experiences/${item.slug || "…"}`}
            onChange={(slug) => {
              setSlugTouched(true);
              set("slug", slugify(slug));
            }}
          />
          <SelectInput
            label="Type"
            value={item.type}
            options={EXPERIENCE_TYPES.map((value) => ({ value, label: TYPE_LABELS[value] }))}
            onChange={(type) => set("type", type)}
          />
          <TextInput label="Date *" value={item.date} dir="ltr" placeholder="YYYY-MM or YYYY-MM-DD" onChange={(v) => set("date", v)} />
          <TextInput label="Client" value={item.client} onChange={(v) => set("client", v)} placeholder="Optional" />
          <TextInput label="External link" value={item.link} dir="ltr" onChange={(v) => set("link", v)} placeholder="https://" />
          <TextInput label="Order (tie-breaker)" type="number" value={item.order} onChange={(v) => set("order", Number(v) || 0)} />
        </div>
        <LocalizedInput label="Location" value={item.location} onChange={(v) => set("location", v)} />
      </Card>

      <Card title="Story">
        <LocalizedInput label="Summary" required multiline rows={3} value={item.summary} onChange={(v) => set("summary", v)} />
        <LocalizedInput label="Body" multiline rows={8} value={item.body} onChange={(v) => set("body", v)} hint="Separate paragraphs with an empty line." />
      </Card>

      <Card title="Images">
        <ImageField label="Cover image" value={item.cover} onChange={(v) => set("cover", v)} aspect="aspect-[4/3]" />
        <ListEditor
          label="Gallery"
          items={item.images}
          onChange={(v) => set("images", v)}
          create={() => ""}
          addLabel="Add image"
          render={(value, update, i) => <ImageField label={`Image ${i + 1}`} value={value} onChange={update} />}
        />
      </Card>
    </EditorShell>
  );
}
