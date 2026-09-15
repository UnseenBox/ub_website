"use client";

import { useState } from "react";
import { deleteServiceAction, saveServiceAction } from "@/app/admin/actions";
import { emptyLocalized } from "@/lib/content/factories";
import { cn } from "@/lib/utils";
import { GLYPHS, type Service } from "@/types/content";
import { PixelGlyph } from "@/components/ui/pixel-glyph";
import { EditorShell } from "./editor-shell";
import { Card, ListEditor, LocalizedInput, TextInput } from "./fields";

export function ServiceEditor({ initial, isNew }: { initial: Service; isNew: boolean }) {
  const [service, setService] = useState<Service>(initial);
  const set = <K extends keyof Service>(key: K, value: Service[K]) => setService((s) => ({ ...s, [key]: value }));

  return (
    <EditorShell
      title={isNew ? "New service" : service.title.en || "Untitled service"}
      backHref="/admin/services"
      backLabel="Services"
      viewHref={isNew ? undefined : "/en/services"}
      onSave={() => saveServiceAction(service)}
      onDelete={isNew ? undefined : () => deleteServiceAction(service.id)}
      afterSaveHref={isNew ? `/admin/services/${service.id}` : undefined}
    >
      <Card title="Content">
        <LocalizedInput label="Title" required value={service.title} onChange={(v) => set("title", v)} />
        <LocalizedInput label="One-line kicker" value={service.kicker} onChange={(v) => set("kicker", v)} />
        <LocalizedInput label="Description" multiline rows={5} value={service.description} onChange={(v) => set("description", v)} />
        <ListEditor
          label="Deliverables / tags"
          items={service.deliverables}
          onChange={(v) => set("deliverables", v)}
          create={emptyLocalized}
          addLabel="Add deliverable"
          render={(item, update) => <LocalizedInput label="Deliverable" value={item} onChange={update} />}
        />
      </Card>

      <Card title="Presentation">
        <fieldset>
          <legend className="text-sm font-medium text-zinc-800">Pixel icon</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {GLYPHS.map((glyph) => (
              <label
                key={glyph}
                className={cn(
                  "flex cursor-pointer flex-col items-center gap-1 rounded-md border p-2 text-xs",
                  service.glyph === glyph ? "border-violet-500 bg-violet-50 text-violet-800" : "border-zinc-300 text-zinc-600",
                )}
              >
                <input type="radio" name="glyph" className="sr-only" checked={service.glyph === glyph} onChange={() => set("glyph", glyph)} />
                <PixelGlyph glyph={glyph} className="size-8 [&_rect]:opacity-100" />
                {glyph}
              </label>
            ))}
          </div>
        </fieldset>
        <TextInput label="Display order" type="number" value={service.order} onChange={(v) => set("order", Number(v) || 0)} hint="You can also reorder from the list." />
      </Card>
    </EditorShell>
  );
}
