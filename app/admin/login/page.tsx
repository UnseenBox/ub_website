import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LogoMark } from "@/components/ui/icons";
import { LoginForm } from "@/components/admin/login-form";
import { adminConfigured, getAdminSession } from "@/lib/auth/guard";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  if (await getAdminSession()) redirect("/admin");
  const configured = adminConfigured();

  return (
    <main className="grid min-h-dvh place-items-center bg-zinc-950 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-3 text-zinc-100">
          <LogoMark className="size-8" />
          <div>
            <p className="font-semibold">UnseenBox</p>
            <p className="text-sm text-zinc-400">Content admin</p>
          </div>
        </div>
        <div className="rounded-xl bg-white p-6 shadow-xl">
          {configured ? (
            <LoginForm />
          ) : (
            <div className="space-y-2 text-sm text-zinc-700">
              <p className="font-semibold text-zinc-900">Admin is not configured</p>
              <p>
                Set <code className="rounded bg-zinc-100 px-1">ADMIN_USERNAME</code>,{" "}
                <code className="rounded bg-zinc-100 px-1">ADMIN_PASSWORD</code> and{" "}
                <code className="rounded bg-zinc-100 px-1">ADMIN_SESSION_SECRET</code> in your environment, then restart.
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
