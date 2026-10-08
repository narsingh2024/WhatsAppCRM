import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type {
  ClientActivity,
  ClientDetail,
  ClientDirectory,
  ClientOwner,
  ClientSummary,
  ClientWhatsApp,
  OnboardedUser,
} from "./client-types";

export type {
  ClientActivity,
  ClientDetail,
  ClientDirectory,
  ClientMember,
  ClientOwner,
  ClientSummary,
  ClientWhatsApp,
  OnboardedUser,
} from "./client-types";

// Service-role reads for the platform client directory. RLS hides
// every account from everyone except its own members, so this path
// is the only way an operator can list onboarded clients. Callers
// must already have passed requirePlatformAdmin().

let adminClient: SupabaseClient | null = null;

function supabaseAdmin(): SupabaseClient {
  if (!adminClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error("Supabase service role is not configured");
    }
    adminClient = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return adminClient;
}

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface AccountRow {
  id: string;
  name: string;
  owner_user_id: string;
  created_at: string;
  updated_at: string;
  default_currency: string | null;
}

interface ProfileRow {
  user_id: string;
  full_name: string | null;
  email: string;
  account_id: string | null;
  account_role: string | null;
  created_at: string | null;
}

interface WhatsAppRow {
  account_id: string;
  status: string;
  phone_number_id: string;
  waba_id: string | null;
  connected_at: string | null;
  registered_at?: string | null;
  subscribed_apps_at?: string | null;
  last_registration_error?: string | null;
}

function fail(error: { message: string } | null, label: string) {
  if (error) throw new Error(`${label}: ${error.message}`);
}

async function countByAccount(
  admin: SupabaseClient,
  table: string,
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  const pageSize = 1000;
  let from = 0;

  for (;;) {
    const { data, error } = await admin
      .from(table)
      .select("account_id")
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);
    fail(error, `count ${table}`);
    const rows = (data ?? []) as { account_id: string | null }[];
    for (const row of rows) {
      if (!row.account_id) continue;
      counts.set(row.account_id, (counts.get(row.account_id) ?? 0) + 1);
    }
    if (rows.length < pageSize) break;
    from += pageSize;
  }

  return counts;
}

async function countWhere(
  admin: SupabaseClient,
  table: string,
  accountId: string,
  column?: string,
  value?: string,
): Promise<number> {
  let query = admin
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("account_id", accountId);
  if (column && value) query = query.eq(column, value);
  const { count, error } = await query;
  fail(error, `count ${table}`);
  return count ?? 0;
}

async function loadWhatsApp(
  admin: SupabaseClient,
  accountId?: string,
): Promise<WhatsAppRow[]> {
  const columns =
    "account_id, status, phone_number_id, waba_id, connected_at, registered_at, subscribed_apps_at, last_registration_error";
  let query = admin.from("whatsapp_config").select(columns);
  if (accountId) query = query.eq("account_id", accountId);
  const { data, error } = await query;
  if (error) {
    const basic = "account_id, status, phone_number_id, waba_id, connected_at";
    let fallback = admin.from("whatsapp_config").select(basic);
    if (accountId) fallback = fallback.eq("account_id", accountId);
    const second = await fallback;
    fail(second.error, "load whatsapp");
    return (second.data ?? []) as WhatsAppRow[];
  }
  return (data ?? []) as unknown as WhatsAppRow[];
}

function toWhatsApp(row: WhatsAppRow | undefined): ClientWhatsApp | null {
  if (!row) return null;
  return {
    status: row.status === "connected" ? "connected" : "disconnected",
    phoneNumberId: row.phone_number_id,
    wabaId: row.waba_id,
    connectedAt: row.connected_at,
    registeredAt: row.registered_at ?? null,
    subscribedAppsAt: row.subscribed_apps_at ?? null,
    lastRegistrationError: row.last_registration_error ?? null,
  };
}

function toOwner(
  profile: ProfileRow | undefined,
  lastSignInAt: string | null = null,
): ClientOwner | null {
  if (!profile) return null;
  return {
    userId: profile.user_id,
    email: profile.email,
    fullName: profile.full_name,
    lastSignInAt,
  };
}

function summarize(
  account: AccountRow,
  profiles: ProfileRow[],
  whatsapp: WhatsAppRow | undefined,
  counts: {
    contacts: Map<string, number>;
    conversations: Map<string, number>;
    deals: Map<string, number>;
    broadcasts: Map<string, number>;
  },
): ClientSummary {
  const members = profiles.filter((p) => p.account_id === account.id);
  const owner =
    profiles.find((p) => p.user_id === account.owner_user_id) ??
    members.find((p) => p.account_role === "owner");
  return {
    id: account.id,
    name: account.name,
    createdAt: account.created_at,
    updatedAt: account.updated_at,
    defaultCurrency: account.default_currency ?? "USD",
    owner: toOwner(owner),
    memberCount: members.length,
    contactCount: counts.contacts.get(account.id) ?? 0,
    conversationCount: counts.conversations.get(account.id) ?? 0,
    dealCount: counts.deals.get(account.id) ?? 0,
    broadcastCount: counts.broadcasts.get(account.id) ?? 0,
    whatsapp: toWhatsApp(whatsapp),
    lastActivityAt: null,
  };
}

interface AuthActivity {
  lastSignInAt: string | null;
  createdAt: string | null;
}

async function loadAuthActivity(admin: SupabaseClient): Promise<Map<string, AuthActivity>> {
  const map = new Map<string, AuthActivity>();
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`load auth users: ${error.message}`);
    for (const user of data.users) {
      map.set(user.id, {
        lastSignInAt: user.last_sign_in_at ?? null,
        createdAt: user.created_at ?? null,
      });
    }
    if (data.users.length < 200) break;
  }
  return map;
}

async function lastActivityByAccount(admin: SupabaseClient): Promise<Map<string, string>> {
  const latest = new Map<string, string>();
  const pageSize = 1000;
  let from = 0;
  for (;;) {
    const { data, error } = await admin
      .from("conversations")
      .select("account_id, last_message_at")
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);
    fail(error, "load activity");
    const rows = (data ?? []) as { account_id: string | null; last_message_at: string | null }[];
    for (const row of rows) {
      if (!row.account_id || !row.last_message_at) continue;
      const prev = latest.get(row.account_id);
      if (!prev || row.last_message_at > prev) latest.set(row.account_id, row.last_message_at);
    }
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return latest;
}

function preview(text: string | null): string | null {
  if (!text) return null;
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return null;
  return clean.length > 160 ? `${clean.slice(0, 157)}...` : clean;
}

const ACCOUNT_COLUMNS =
  "id, name, owner_user_id, created_at, updated_at, default_currency";

export async function listClients(): Promise<ClientDirectory> {
  const admin = supabaseAdmin();
  const [accountsRes, profilesRes, whatsapp, contacts, conversations, deals, broadcasts, authActivity, activity] =
    await Promise.all([
      admin.from("accounts").select(ACCOUNT_COLUMNS).order("created_at", { ascending: false }),
      admin
        .from("profiles")
        .select("user_id, full_name, email, account_id, account_role, created_at"),
      loadWhatsApp(admin),
      countByAccount(admin, "contacts"),
      countByAccount(admin, "conversations"),
      countByAccount(admin, "deals"),
      countByAccount(admin, "broadcasts"),
      loadAuthActivity(admin),
      lastActivityByAccount(admin),
    ]);

  fail(accountsRes.error, "load accounts");
  fail(profilesRes.error, "load profiles");

  const profiles = (profilesRes.data ?? []) as ProfileRow[];
  const accounts = (accountsRes.data ?? []) as AccountRow[];
  const whatsappByAccount = new Map(whatsapp.map((row) => [row.account_id, row]));
  const counts = { contacts, conversations, deals, broadcasts };
  const accountNames = new Map(accounts.map((account) => [account.id, account.name]));

  const clients = accounts.map((account) => {
    const summary = summarize(account, profiles, whatsappByAccount.get(account.id), counts);
    const ownerId = summary.owner?.userId;
    return {
      ...summary,
      lastActivityAt: activity.get(account.id) ?? null,
      owner: summary.owner
        ? {
            ...summary.owner,
            lastSignInAt: ownerId ? authActivity.get(ownerId)?.lastSignInAt ?? null : null,
          }
        : null,
    };
  });

  const users: OnboardedUser[] = profiles
    .map((profile) => ({
      userId: profile.user_id,
      email: profile.email,
      fullName: profile.full_name,
      role: profile.account_role,
      accountId: profile.account_id,
      accountName: profile.account_id ? accountNames.get(profile.account_id) ?? null : null,
      signedUpAt: authActivity.get(profile.user_id)?.createdAt ?? profile.created_at,
      lastSignInAt: authActivity.get(profile.user_id)?.lastSignInAt ?? null,
    }))
    .sort((a, b) => (b.signedUpAt ?? "").localeCompare(a.signedUpAt ?? ""));

  return { clients, users };
}

const ROLE_ORDER = ["owner", "admin", "agent", "viewer"];

export async function getClient(accountId: string): Promise<ClientDetail | null> {
  if (!UUID.test(accountId)) return null;
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("accounts")
    .select(ACCOUNT_COLUMNS)
    .eq("id", accountId)
    .maybeSingle();
  fail(error, "load account");
  if (!data) return null;

  const account = data as AccountRow;
  const [profilesRes, ownerRes, whatsappRows, contactCount, conversationCount, dealCount, broadcastCount, openConversations, pendingConversations, closedConversations, automationCount, flowCount] =
    await Promise.all([
      admin
        .from("profiles")
        .select("user_id, full_name, email, account_id, account_role, created_at")
        .eq("account_id", accountId),
      admin
        .from("profiles")
        .select("user_id, full_name, email, account_id, account_role, created_at")
        .eq("user_id", account.owner_user_id)
        .maybeSingle(),
      loadWhatsApp(admin, accountId),
      countWhere(admin, "contacts", accountId),
      countWhere(admin, "conversations", accountId),
      countWhere(admin, "deals", accountId),
      countWhere(admin, "broadcasts", accountId),
      countWhere(admin, "conversations", accountId, "status", "open"),
      countWhere(admin, "conversations", accountId, "status", "pending"),
      countWhere(admin, "conversations", accountId, "status", "closed"),
      countWhere(admin, "automations", accountId),
      countWhere(admin, "flows", accountId),
    ]);
  fail(profilesRes.error, "load members");
  fail(ownerRes.error, "load owner");

  const membersOnAccount = (profilesRes.data ?? []) as ProfileRow[];
  const ownerRow = (ownerRes.data ?? null) as ProfileRow | null;
  const profiles =
    ownerRow && !membersOnAccount.some((p) => p.user_id === ownerRow.user_id)
      ? [...membersOnAccount, ownerRow]
      : membersOnAccount;
  const counts = {
    contacts: new Map([[accountId, contactCount]]),
    conversations: new Map([[accountId, conversationCount]]),
    deals: new Map([[accountId, dealCount]]),
    broadcasts: new Map([[accountId, broadcastCount]]),
  };
  const summary = summarize(account, profiles, whatsappRows[0], counts);
  const [authActivity, activityRes] = await Promise.all([
    loadAuthActivity(admin),
    admin
      .from("conversations")
      .select("status, last_message_text, last_message_at, unread_count, contact_id")
      .eq("account_id", accountId)
      .order("last_message_at", { ascending: false })
      .limit(20),
  ]);
  fail(activityRes.error, "load activity");

  const activityRows = (activityRes.data ?? []) as {
    status: string;
    last_message_text: string | null;
    last_message_at: string | null;
    unread_count: number | null;
    contact_id: string | null;
  }[];
  const contactIds = [...new Set(activityRows.map((row) => row.contact_id).filter(Boolean))] as string[];
  const contactMap = new Map<string, { name: string | null; phone: string | null }>();
  if (contactIds.length > 0) {
    const { data: contactRows, error: contactErr } = await admin
      .from("contacts")
      .select("id, name, phone")
      .in("id", contactIds);
    fail(contactErr, "load activity contacts");
    for (const contact of (contactRows ?? []) as {
      id: string;
      name: string | null;
      phone: string | null;
    }[]) {
      contactMap.set(contact.id, { name: contact.name, phone: contact.phone });
    }
  }

  const recentActivity: ClientActivity[] = activityRows.map((row) => {
    const contact = row.contact_id ? contactMap.get(row.contact_id) : undefined;
    return {
      contactName: contact?.name ?? null,
      contactPhone: contact?.phone ?? null,
      status: row.status,
      lastMessageText: preview(row.last_message_text),
      lastMessageAt: row.last_message_at,
      unreadCount: row.unread_count ?? 0,
    };
  });
  const lastActivityAt = recentActivity.find((item) => item.lastMessageAt)?.lastMessageAt ?? null;
  const ownerSignIn = authActivity.get(account.owner_user_id)?.lastSignInAt ?? null;

  const members = profiles
    .filter((p) => p.account_id === accountId)
    .map((p) => ({
      userId: p.user_id,
      email: p.email,
      fullName: p.full_name,
      role: p.account_role ?? "viewer",
      createdAt: p.created_at,
      lastSignInAt: authActivity.get(p.user_id)?.lastSignInAt ?? null,
    }))
    .sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role));

  return {
    ...summary,
    lastActivityAt,
    owner: summary.owner ? { ...summary.owner, lastSignInAt: ownerSignIn } : null,
    members,
    openConversations,
    pendingConversations,
    closedConversations,
    automationCount,
    flowCount,
    recentActivity,
  };
}
