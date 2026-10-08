"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";

import type { ClientDetail } from "@/lib/admin/client-types";

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="mt-1 text-sm break-all text-foreground">{value}</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="mt-2 text-2xl font-bold tabular-nums text-foreground">
        {value.toLocaleString()}
      </p>
    </div>
  );
}

export function ClientDetailView({ accountId }: { accountId: string }) {
  const t = useTranslations("AdminClients");
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [error, setError] = useState<"forbidden" | "missing" | "load" | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/admin/clients/${accountId}`);
        if (res.status === 401 || res.status === 403) {
          if (!cancelled) setError("forbidden");
          return;
        }
        if (res.status === 404) {
          if (!cancelled) setError("missing");
          return;
        }
        if (!res.ok) {
          if (!cancelled) setError("load");
          return;
        }
        const body = (await res.json()) as { client: ClientDetail };
        if (!cancelled) setClient(body.client);
      } catch {
        if (!cancelled) setError("load");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accountId]);

  if (error === "forbidden") {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-border bg-card p-6">
        <h1 className="text-lg font-semibold text-foreground">{t("forbiddenTitle")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("forbiddenBody")}</p>
      </div>
    );
  }

  if (error === "missing") {
    return (
      <div className="space-y-3">
        <BackLink label={t("back")} />
        <p className="text-sm text-muted-foreground">{t("notFound")}</p>
      </div>
    );
  }

  if (error === "load") {
    return <p className="text-sm text-destructive">{t("loadError")}</p>;
  }

  if (!client) {
    return <p className="text-sm text-muted-foreground">{t("loading")}</p>;
  }

  const whatsappLabel = !client.whatsapp
    ? t("notConnected")
    : client.whatsapp.status === "connected"
      ? t("connected")
      : t("disconnected");

  const roleLabel = (role: string) => {
    if (role === "owner") return t("roleOwner");
    if (role === "admin") return t("roleAdmin");
    if (role === "agent") return t("roleAgent");
    if (role === "viewer") return t("roleViewer");
    return role;
  };

  return (
    <div className="space-y-6">
      <div>
        <BackLink label={t("back")} />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-foreground">{client.name}</h1>
          <span
            className={
              client.whatsapp?.status === "connected"
                ? "inline-flex rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                : "inline-flex rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground"
            }
          >
            {whatsappLabel}
          </span>
        </div>
        <p className="mt-1 font-mono text-xs text-muted-foreground">{client.id}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label={t("colMembers")} value={client.memberCount} />
        <Stat label={t("colContacts")} value={client.contactCount} />
        <Stat label={t("statsOpen")} value={client.openConversations} />
        <Stat label={t("statsPending")} value={client.pendingConversations} />
        <Stat label={t("statsClosed")} value={client.closedConversations} />
        <Stat label={t("statsDeals")} value={client.dealCount} />
        <Stat label={t("statsBroadcasts")} value={client.broadcastCount} />
        <Stat label={t("statsAutomations")} value={client.automationCount} />
        <Stat label={t("statsFlows")} value={client.flowCount} />
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">{t("accountTitle")}</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Fact label={t("colOwner")} value={client.owner?.fullName || "—"} />
          <Fact label={t("colEmail")} value={client.owner?.email || "—"} />
          <Fact label={t("colLastSignIn")} value={formatDate(client.owner?.lastSignInAt)} />
          <Fact label={t("colLastActivity")} value={formatDate(client.lastActivityAt)} />
          <Fact label={t("currency")} value={client.defaultCurrency} />
          <Fact label={t("colSignedUp")} value={formatDate(client.createdAt)} />
          <Fact label={t("updated")} value={formatDate(client.updatedAt)} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">{t("whatsappTitle")}</h2>
        {client.whatsapp ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Fact label={t("colWhatsapp")} value={whatsappLabel} />
            <Fact label={t("phoneNumberId")} value={client.whatsapp.phoneNumberId} />
            <Fact label={t("wabaId")} value={client.whatsapp.wabaId || "—"} />
            <Fact label={t("connectedAt")} value={formatDate(client.whatsapp.connectedAt)} />
            <Fact label={t("registeredAt")} value={formatDate(client.whatsapp.registeredAt)} />
            <Fact label={t("subscribedAt")} value={formatDate(client.whatsapp.subscribedAppsAt)} />
            {client.whatsapp.lastRegistrationError ? (
              <Fact label={t("registrationError")} value={client.whatsapp.lastRegistrationError} />
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t("whatsappEmpty")}</p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">{t("activityTitle")}</h2>
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-border text-xs tracking-wide text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-3 font-medium">{t("colContact")}</th>
                <th className="px-4 py-3 font-medium">{t("colStatus")}</th>
                <th className="px-4 py-3 font-medium">{t("colLastMessage")}</th>
                <th className="px-4 py-3 font-medium">{t("colWhen")}</th>
              </tr>
            </thead>
            <tbody>
              {client.recentActivity.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-muted-foreground">
                    {t("activityEmpty")}
                  </td>
                </tr>
              ) : (
                client.recentActivity.map((item, index) => (
                  <tr key={`${item.contactPhone ?? "chat"}-${index}`} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      <p className="text-foreground">{item.contactName || "—"}</p>
                      <p className="text-xs text-muted-foreground">{item.contactPhone || "—"}</p>
                    </td>
                    <td className="px-4 py-3 capitalize">{item.status}</td>
                    <td className="px-4 py-3 text-muted-foreground">{item.lastMessageText || "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                      {formatDate(item.lastMessageAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">{t("membersTitle")}</h2>
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-border text-xs tracking-wide text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-3 font-medium">{t("colName")}</th>
                <th className="px-4 py-3 font-medium">{t("colEmail")}</th>
                <th className="px-4 py-3 font-medium">{t("colRole")}</th>
                <th className="px-4 py-3 font-medium">{t("colJoined")}</th>
                <th className="px-4 py-3 font-medium">{t("colLastSignIn")}</th>
              </tr>
            </thead>
            <tbody>
              {client.members.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-muted-foreground">
                    {t("noMembers")}
                  </td>
                </tr>
              ) : (
                client.members.map((member) => (
                  <tr key={member.userId} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 text-foreground">{member.fullName || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{member.email}</td>
                    <td className="px-4 py-3">{roleLabel(member.role)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                      {formatDate(member.createdAt)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                      {formatDate(member.lastSignInAt)}
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

function BackLink({ label }: { label: string }) {
  return (
    <Link
      href="/admin"
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" />
      {label}
    </Link>
  );
}
