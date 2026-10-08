"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { MessageSquare, PlugZap, Search, Users } from "lucide-react";

import { MetricCard } from "@/components/dashboard/metric-card";
import { SkeletonCard } from "@/components/dashboard/skeleton";
import { Input } from "@/components/ui/input";
import type { ClientDirectory, ClientSummary, OnboardedUser } from "@/lib/admin/client-types";

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function WhatsAppBadge({
  client,
  labels,
}: {
  client: ClientSummary;
  labels: { connected: string; disconnected: string; notConnected: string };
}) {
  if (!client.whatsapp) {
    return (
      <span className="inline-flex rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
        {labels.notConnected}
      </span>
    );
  }
  const live = client.whatsapp.status === "connected";
  return (
    <span
      className={
        live
          ? "inline-flex rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
          : "inline-flex rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground"
      }
    >
      {live ? labels.connected : labels.disconnected}
    </span>
  );
}

export function ClientDirectory() {
  const t = useTranslations("AdminClients");
  const [clients, setClients] = useState<ClientSummary[] | null>(null);
  const [users, setUsers] = useState<OnboardedUser[]>([]);
  const [error, setError] = useState<"forbidden" | "load" | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/clients");
        if (res.status === 401 || res.status === 403) {
          if (!cancelled) setError("forbidden");
          return;
        }
        if (!res.ok) {
          if (!cancelled) setError("load");
          return;
        }
        const body = (await res.json()) as ClientDirectory;
        if (!cancelled) {
          setClients(body.clients);
          setUsers(body.users ?? []);
        }
      } catch {
        if (!cancelled) setError("load");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!clients) return [];
    const needle = query.trim().toLowerCase();
    if (!needle) return clients;
    return clients.filter((client) => {
      const haystack = [
        client.name,
        client.owner?.email,
        client.owner?.fullName,
        client.whatsapp?.phoneNumberId,
        client.whatsapp?.wabaId,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [clients, query]);

  const filteredUsers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return users;
    return users.filter((user) => {
      const haystack = [user.fullName, user.email, user.accountName, user.role]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [users, query]);

  if (error === "forbidden") {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-border bg-card p-6">
        <h1 className="text-lg font-semibold text-foreground">{t("forbiddenTitle")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("forbiddenBody")}</p>
      </div>
    );
  }

  if (error === "load") {
    return <p className="text-sm text-destructive">{t("loadError")}</p>;
  }

  const connected = clients?.filter((c) => c.whatsapp?.status === "connected").length ?? 0;
  const missing = (clients?.length ?? 0) - connected;
  const contacts = clients?.reduce((sum, c) => sum + c.contactCount, 0) ?? 0;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("description")}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {!clients ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <MetricCard
              title={t("totalClients")}
              value={clients.length.toLocaleString()}
              icon={Users}
              subtitle={t("signedUpAccounts")}
            />
            <MetricCard
              title={t("whatsappConnected")}
              value={connected.toLocaleString()}
              icon={PlugZap}
              subtitle={t("liveNumbers")}
            />
            <MetricCard
              title={t("whatsappMissing")}
              value={missing.toLocaleString()}
              icon={MessageSquare}
              subtitle={t("notLive")}
            />
            <MetricCard
              title={t("totalContacts")}
              value={contacts.toLocaleString()}
              icon={Users}
              subtitle={t("acrossClients")}
            />
          </>
        )}
      </div>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="pl-8"
          aria-label={t("searchPlaceholder")}
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[1080px] text-left text-sm">
          <thead className="border-b border-border text-xs tracking-wide text-muted-foreground uppercase">
            <tr>
              <th className="px-4 py-3 font-medium">{t("colAccount")}</th>
              <th className="px-4 py-3 font-medium">{t("colOwner")}</th>
              <th className="px-4 py-3 font-medium">{t("colSignedUp")}</th>
              <th className="px-4 py-3 font-medium">{t("colLastSignIn")}</th>
              <th className="px-4 py-3 font-medium">{t("colLastActivity")}</th>
              <th className="px-4 py-3 font-medium">{t("colWhatsapp")}</th>
              <th className="px-4 py-3 font-medium">{t("colMembers")}</th>
              <th className="px-4 py-3 font-medium">{t("colContacts")}</th>
              <th className="px-4 py-3 font-medium">{t("colConversations")}</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {!clients ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-muted-foreground">
                  {t("loading")}
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-muted-foreground">
                  {clients.length === 0 ? t("empty") : t("noMatches")}
                </td>
              </tr>
            ) : (
              filtered.map((client) => (
                <tr key={client.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{client.name}</p>
                    <p className="mt-0.5 font-mono text-xs text-muted-foreground">{client.id}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-foreground">{client.owner?.fullName || "—"}</p>
                    <p className="text-xs text-muted-foreground">{client.owner?.email || "—"}</p>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                    {formatDate(client.createdAt)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                    {formatDate(client.owner?.lastSignInAt)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                    {formatDate(client.lastActivityAt)}
                  </td>
                  <td className="px-4 py-3">
                    <WhatsAppBadge
                      client={client}
                      labels={{
                        connected: t("connected"),
                        disconnected: t("disconnected"),
                        notConnected: t("notConnected"),
                      }}
                    />
                    {client.whatsapp?.phoneNumberId ? (
                      <p className="mt-1 font-mono text-xs text-muted-foreground">
                        {client.whatsapp.phoneNumberId}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{client.memberCount}</td>
                  <td className="px-4 py-3 tabular-nums">{client.contactCount.toLocaleString()}</td>
                  <td className="px-4 py-3 tabular-nums">
                    {client.conversationCount.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/${client.id}`}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      {t("view")}
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{t("usersTitle")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("usersDescription")}</p>
        </div>
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="border-b border-border text-xs tracking-wide text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-3 font-medium">{t("colName")}</th>
                <th className="px-4 py-3 font-medium">{t("colEmail")}</th>
                <th className="px-4 py-3 font-medium">{t("colAccount")}</th>
                <th className="px-4 py-3 font-medium">{t("colRole")}</th>
                <th className="px-4 py-3 font-medium">{t("colSignedUp")}</th>
                <th className="px-4 py-3 font-medium">{t("colLastSignIn")}</th>
              </tr>
            </thead>
            <tbody>
              {!clients ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-muted-foreground">
                    {t("loading")}
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-muted-foreground">
                    {t("noUsers")}
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.userId} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 text-foreground">{user.fullName || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
                    <td className="px-4 py-3">
                      {user.accountId ? (
                        <Link href={`/admin/${user.accountId}`} className="text-primary hover:underline">
                          {user.accountName || user.accountId}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3">{user.role || "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                      {formatDate(user.signedUpAt)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                      {formatDate(user.lastSignInAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
