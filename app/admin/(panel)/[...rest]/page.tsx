import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/guard";

export default async function AdminCatchAll() {
  await requireAdmin();
  notFound();
}
