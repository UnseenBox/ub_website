import type { Metadata } from "next";
import { DriveTool } from "@/components/admin/drive-tool";
import { requireAdmin } from "@/lib/auth/guard";

export const metadata: Metadata = { title: "Images guide" };

export default async function MediaGuidePage() {
  await requireAdmin();

  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Images guide</h1>
        <p className="text-sm text-zinc-600">
          Keep artwork in Google Drive and paste links into any image field. No rebuild or redeploy is needed.
        </p>
      </header>

      <section className="rounded-lg border border-zinc-200 bg-white p-6">
        <h2 className="font-semibold">Using Google Drive</h2>
        <ol className="mt-3 list-decimal space-y-2 ps-5 text-sm text-zinc-700">
          <li>Upload the image to a Drive folder (JPG, PNG or WebP; ideally 2400px wide for covers, 1500px tall for posters).</li>
          <li>
            Right-click → <strong>Share</strong> → General access: <strong>Anyone with the link</strong> (Viewer).
          </li>
          <li>Copy the link and paste it into the image field. The preview confirms it works.</li>
          <li>To replace an image, paste a new link — or upload a new file and update the link.</li>
        </ol>
        <p className="mt-4 rounded-md bg-zinc-50 p-3 text-xs leading-relaxed text-zinc-600">
          Visitors never download from Drive directly: Vercel fetches each image once, converts it to AVIF/WebP at the right
          size for each screen, and serves it from its CDN (cached for 30 days). Private or restricted Drive files cannot be
          displayed.
        </p>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-6">
        <h2 className="mb-4 font-semibold">Link tester</h2>
        <DriveTool />
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-6 text-sm text-zinc-700">
        <h2 className="font-semibold text-zinc-900">Other accepted sources</h2>
        <ul className="mt-3 list-disc space-y-1.5 ps-5">
          <li>
            <code className="rounded bg-zinc-100 px-1">drive:FILE_ID</code> — shorthand for a Drive file.
          </li>
          <li>
            <code className="rounded bg-zinc-100 px-1">/media/…</code> — files committed to the repository&apos;s public folder.
          </li>
          <li>
            Any <code className="rounded bg-zinc-100 px-1">https://</code> image URL. Hosts not listed in{" "}
            <code className="rounded bg-zinc-100 px-1">next.config.ts</code> are shown unoptimised.
          </li>
        </ul>
      </section>
    </div>
  );
}
