import Link from "next/link";

export default function AdminNotFound() {
  return (
    <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-10 text-center">
      <h1 className="text-xl font-semibold">Page not found</h1>
      <p className="mt-2 text-sm text-zinc-600">This admin page or record doesn&apos;t exist.</p>
      <Link href="/admin" className="mt-4 inline-block text-sm font-medium text-violet-700 hover:underline">
        Back to dashboard
      </Link>
    </div>
  );
}
