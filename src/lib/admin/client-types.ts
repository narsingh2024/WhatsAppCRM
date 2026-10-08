export interface ClientOwner {
  userId: string;
  email: string;
  fullName: string | null;
  lastSignInAt: string | null;
}

export interface ClientWhatsApp {
  status: "connected" | "disconnected";
  phoneNumberId: string;
  wabaId: string | null;
  connectedAt: string | null;
  registeredAt: string | null;
  subscribedAppsAt: string | null;
  lastRegistrationError: string | null;
}

export interface ClientSummary {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  defaultCurrency: string;
  owner: ClientOwner | null;
  memberCount: number;
  contactCount: number;
  conversationCount: number;
  dealCount: number;
  broadcastCount: number;
  whatsapp: ClientWhatsApp | null;
  /** Newest conversation activity on this account, if any. */
  lastActivityAt: string | null;
}

export interface ClientMember {
  userId: string;
  email: string;
  fullName: string | null;
  role: string;
  createdAt: string | null;
  lastSignInAt: string | null;
}

export interface ClientActivity {
  contactName: string | null;
  contactPhone: string | null;
  status: string;
  lastMessageText: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
}

export interface OnboardedUser {
  userId: string;
  email: string;
  fullName: string | null;
  role: string | null;
  accountId: string | null;
  accountName: string | null;
  signedUpAt: string | null;
  lastSignInAt: string | null;
}

export interface ClientDirectory {
  clients: ClientSummary[];
  users: OnboardedUser[];
}

export interface ClientDetail extends ClientSummary {
  members: ClientMember[];
  openConversations: number;
  pendingConversations: number;
  closedConversations: number;
  automationCount: number;
  flowCount: number;
  recentActivity: ClientActivity[];
}
