"use client";

import { useState } from "react";
import { saveStudioAction } from "@/app/admin/actions";
import { emptyLocalized } from "@/lib/content/factories";
import { emptyHomeCopy } from "@/lib/content/home-copy";
import { newId } from "@/lib/utils";
import { SOCIAL_PLATFORMS, type HomeCopy, type LocalizedString, type StudioInfo } from "@/types/content";
import { EditorShell } from "./editor-shell";
import { Card, ImageField, ListEditor, LocalizedInput, TextInput } from "./fields";

const SOCIAL_LABELS: Record<string, string> = {
  instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube", x: "X", linkedin: "LinkedIn", discord: "Discord",
  steam: "Steam", itch: "itch.io", bluesky: "Bluesky", twitch: "Twitch", github: "GitHub",
};

export function StudioEditor({ initial }: { initial: StudioInfo }) {
  const [studio, setStudio] = useState<StudioInfo>(initial);
  const set = <K extends keyof StudioInfo>(key: K, value: StudioInfo[K]) => setStudio((s) => ({ ...s, [key]: value }));

  // Home-page overrides: blank fields fall back to the built-in wording.
  const home = studio.home ?? emptyHomeCopy();
  const setHome = <K extends keyof HomeCopy>(key: K, value: HomeCopy[K]) =>
    set("home", { ...home, [key]: value });

  const socialUrl = (platform: string) => studio.socials.find((s) => s.platform === platform)?.url ?? "";
  const setSocial = (platform: (typeof SOCIAL_PLATFORMS)[number], url: string) =>
    set("socials", [...studio.socials.filter((s) => s.platform !== platform), { platform, url }].sort(
      (a, b) => SOCIAL_PLATFORMS.indexOf(a.platform) - SOCIAL_PLATFORMS.indexOf(b.platform),
    ));

  return (
    <EditorShell
      title="Studio & contact"
      backHref="/admin"
      backLabel="Dashboard"
      viewHref="/en/about"
      onSave={() => saveStudioAction(studio)}
    >
      <Card title="Identity & contact">
        <div className="grid gap-5 sm:grid-cols-2">
          <TextInput label="Studio name" value={studio.name} onChange={(v) => set("name", v)} />
          <TextInput label="Founded (year)" value={studio.foundedYear} onChange={(v) => set("foundedYear", v)} />
          <TextInput label="Contact email" type="email" dir="ltr" value={studio.email} onChange={(v) => set("email", v)} />
          <TextInput label="Press email" type="email" dir="ltr" value={studio.pressEmail} onChange={(v) => set("pressEmail", v)} placeholder="Optional" />
          <TextInput label="Phone" dir="ltr" value={studio.phone} onChange={(v) => set("phone", v)} placeholder="Optional" />
          <TextInput label="Time zone (studio clock)" dir="ltr" value={studio.timezone} onChange={(v) => set("timezone", v)} hint="IANA name, e.g. Africa/Algiers, Europe/Paris." />
        </div>
        <ImageField
          label="Website logo"
          value={studio.logo ?? ""}
          onChange={(v) => set("logo", v)}
          aspect="aspect-[3/1]"
          hint="Shown in the header and footer. Leave empty to use the built-in UnseenBox mark. A transparent PNG or SVG on a dark background works best."
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <LocalizedInput label="City" value={studio.city} onChange={(v) => set("city", v)} />
          <LocalizedInput label="Country" value={studio.country} onChange={(v) => set("country", v)} />
        </div>
        <LocalizedInput label="Availability line" value={studio.availability} onChange={(v) => set("availability", v)} hint="Shown on Services and Contact, e.g. “Taking on two collaborations for early 2027.”" />
      </Card>

      <Card title="Social links" description="Leave a field empty to hide that platform everywhere on the site.">
        <div className="grid gap-4 sm:grid-cols-2">
          {SOCIAL_PLATFORMS.map((platform) => (
            <TextInput
              key={platform}
              label={SOCIAL_LABELS[platform]}
              dir="ltr"
              value={socialUrl(platform)}
              placeholder="https://"
              onChange={(url) => setSocial(platform, url)}
            />
          ))}
        </div>
      </Card>

      <Card title="About the studio">
        <LocalizedInput label="Tagline (used in SEO & footer)" required value={studio.tagline} onChange={(v) => set("tagline", v)} />
        <LocalizedInput label="Manifesto" required multiline rows={3} value={studio.manifesto} onChange={(v) => set("manifesto", v)} />
        <LocalizedInput label="Introduction" required multiline rows={8} value={studio.intro} onChange={(v) => set("intro", v)} hint="First paragraph is the lede. Separate paragraphs with an empty line." />
        <LocalizedInput label="Approach" multiline rows={5} value={studio.approach} onChange={(v) => set("approach", v)} />
        <LocalizedInput label="Ambition" multiline rows={4} value={studio.ambition} onChange={(v) => set("ambition", v)} />
      </Card>

      <Card
        title="Home page"
        description="The wording on the home page. Leave a field empty to keep the built-in text for that language."
      >
        <ListEditor
          label="Hero channels (the three lines above the title)"
          items={home.heroChannels}
          onChange={(v) => setHome("heroChannels", v)}
          create={() => emptyLocalized()}
          addLabel="Add channel"
          hint="Shown as CH.01, CH.02, CH.03. Add up to four."
          render={(value: LocalizedString, update, i) => (
            <LocalizedInput label={`Channel ${i + 1}`} value={value} onChange={update} />
          )}
        />
        <ListEditor
          label="Hero headline (one entry per line)"
          items={home.heroLines}
          onChange={(v) => setHome("heroLines", v)}
          create={() => emptyLocalized()}
          addLabel="Add line"
          hint="The last line is highlighted, e.g. “Every world” / “begins” / “unseen.”"
          render={(value: LocalizedString, update, i) => (
            <LocalizedInput label={`Line ${i + 1}`} value={value} onChange={update} />
          )}
        />
        <LocalizedInput label="Hero paragraph" multiline rows={3} value={home.heroIntro} onChange={(v) => setHome("heroIntro", v)} />
        <div className="grid gap-5 sm:grid-cols-2">
          <LocalizedInput label="Primary button" value={home.heroCtaPrimary} onChange={(v) => setHome("heroCtaPrimary", v)} />
          <LocalizedInput label="Secondary button" value={home.heroCtaSecondary} onChange={(v) => setHome("heroCtaSecondary", v)} />
        </div>
        <LocalizedInput label="Scroll hint" value={home.heroScroll} onChange={(v) => setHome("heroScroll", v)} />

        <LocalizedInput label="Manifesto section label" value={home.manifestoLabel} onChange={(v) => setHome("manifestoLabel", v)} hint="The manifesto text itself is under “About the studio”." />

        <div className="grid gap-5 sm:grid-cols-2">
          <LocalizedInput label="Games section label" value={home.showcaseLabel} onChange={(v) => setHome("showcaseLabel", v)} />
          <LocalizedInput label="Games section heading" value={home.showcaseTitle} onChange={(v) => setHome("showcaseTitle", v)} />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <LocalizedInput label="Upcoming section label" value={home.upcomingLabel} onChange={(v) => setHome("upcomingLabel", v)} />
          <LocalizedInput label="Upcoming section heading" value={home.upcomingTitle} onChange={(v) => setHome("upcomingTitle", v)} />
        </div>
        <LocalizedInput label="Upcoming section paragraph" multiline rows={2} value={home.upcomingIntro} onChange={(v) => setHome("upcomingIntro", v)} />

        <div className="grid gap-5 sm:grid-cols-2">
          <LocalizedInput label="Services section label" value={home.servicesLabel} onChange={(v) => setHome("servicesLabel", v)} />
          <LocalizedInput label="Services section heading" value={home.servicesTitle} onChange={(v) => setHome("servicesTitle", v)} />
        </div>
        <LocalizedInput label="Services section paragraph" multiline rows={2} value={home.servicesIntro} onChange={(v) => setHome("servicesIntro", v)} />

        <div className="grid gap-5 sm:grid-cols-2">
          <LocalizedInput label="Archive section label" value={home.archiveLabel} onChange={(v) => setHome("archiveLabel", v)} />
          <LocalizedInput label="Archive section heading" value={home.archiveTitle} onChange={(v) => setHome("archiveTitle", v)} />
        </div>
        <LocalizedInput label="Archive section paragraph" multiline rows={2} value={home.archiveIntro} onChange={(v) => setHome("archiveIntro", v)} />

        <div className="grid gap-5 sm:grid-cols-2">
          <LocalizedInput label="Studio teaser label" value={home.studioLabel} onChange={(v) => setHome("studioLabel", v)} />
          <LocalizedInput label="Studio teaser heading" value={home.studioTitle} onChange={(v) => setHome("studioTitle", v)} />
        </div>
      </Card>

      <Card title="Beliefs">
        <ListEditor
          label="What we believe"
          items={studio.beliefs}
          onChange={(v) => set("beliefs", v)}
          create={() => ({ id: newId("belief"), title: emptyLocalized(), text: emptyLocalized() })}
          addLabel="Add belief"
          render={(belief, update) => (
            <div className="grid gap-3">
              <LocalizedInput label="Title" value={belief.title} onChange={(title) => update({ ...belief, title })} />
              <LocalizedInput label="Text" multiline rows={2} value={belief.text} onChange={(text) => update({ ...belief, text })} />
            </div>
          )}
        />
      </Card>

      <Card title="Timeline">
        <ListEditor
          label="Studio history"
          items={studio.timeline}
          onChange={(v) => set("timeline", v)}
          create={() => ({ id: newId("m"), year: String(new Date().getFullYear()), title: emptyLocalized(), text: emptyLocalized() })}
          addLabel="Add milestone"
          render={(milestone, update) => (
            <div className="grid gap-3">
              <TextInput label="Year" value={milestone.year} onChange={(year) => update({ ...milestone, year })} />
              <LocalizedInput label="Title" value={milestone.title} onChange={(title) => update({ ...milestone, title })} />
              <LocalizedInput label="Text" multiline rows={2} value={milestone.text} onChange={(text) => update({ ...milestone, text })} />
            </div>
          )}
        />
      </Card>
    </EditorShell>
  );
}
