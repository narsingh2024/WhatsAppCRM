"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

export default function AdminConsoleLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations("AdminClients");
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/session")
      .then((res) => (res.ok ? res.json() : { platformAdmin: false }))
      .then((body: { platformAdmin?: boolean }) => {
        if (cancelled) return;
        if (!body.platformAdmin) {
          router.replace("/admin/login");
          return;
        }
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) router.replace("/admin/login");
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  const signOut = async () => {
    await fetch("/api/admin/session", { method: "DELETE" });
    window.location.href = "/admin/login";
  };

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="flex h-14 items-center justify-between border-b border-border px-4 sm:px-6">
        <p className="text-sm font-semibold text-foreground">{t("title")}</p>
        <button
          type="button"
          onClick={signOut}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          {t("signOut")}
        </button>
      </header>
      <main className="p-4 sm:p-6">{children}</main>
    </div>
  );
}
