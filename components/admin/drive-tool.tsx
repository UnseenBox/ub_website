"use client";

import { useState } from "react";
import { extractDriveId, resolveImageSrc } from "@/lib/images/drive";
import { SmartImage } from "@/components/ui/smart-image";
import { inputClass } from "./fields";

export function DriveTool() {
  const [value, setValue] = useState("");
  const id = extractDriveId(value);
  const resolved = resolveImageSrc(value);

  return (
    <div className="grid gap-4 sm:grid-cols-[1fr_14rem]">
      <div className="grid gap-2">
        <label htmlFor="drive-test" className="text-sm font-medium">
          Test a link
        </label>
        <input
          id="drive-test"
          dir="ltr"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="https://drive.google.com/file/d/…/view?usp=sharing"
          className={inputClass}
        />
        {value && (
          <dl className="grid gap-1 text-xs text-zinc-600">
            <div>
              <dt className="inline font-medium">Drive file ID: </dt>
              <dd className="inline break-all font-mono">{id ?? "—"}</dd>
            </div>
            <div>
              <dt className="inline font-medium">Served from: </dt>
              <dd className="inline break-all font-mono">{resolved ?? "not a usable image reference"}</dd>
            </div>
          </dl>
        )}
      </div>
      <div className="relative aspect-video overflow-hidden rounded-md border border-zinc-200 bg-zinc-100">
        {resolved ? (
          <SmartImage key={resolved} src={value} alt="Preview" sizes="14rem" />
        ) : (
          <span className="absolute inset-0 grid place-items-center text-xs text-zinc-400">Preview</span>
        )}
      </div>
    </div>
  );
}
