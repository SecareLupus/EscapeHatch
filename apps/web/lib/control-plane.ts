import type { Channel, ChatMessage, Server } from "@escapehatch/shared";

export const controlPlaneBaseUrl =
  process.env.NEXT_PUBLIC_CONTROL_PLANE_URL ?? "http://localhost:4000";

export interface ViewerSession {
  productUserId: string;
  identity: {
    provider: string;
    preferredUsername: string | null;
    email: string | null;
  } | null;
}

export interface BootstrapStatus {
  initialized: boolean;
  bootstrapCompletedAt?: string | null;
  bootstrapAdminUserId?: string | null;
  bootstrapHubId?: string | null;
  defaultServerId?: string | null;
  defaultChannelId?: string | null;
  code?: string;
  message?: string;
}

export interface AuthProviderDescriptor {
  provider: string;
  displayName: string;
  isEnabled: boolean;
  requiresReauthentication: boolean;
}

export interface AuthProvidersResponse {
  primaryProvider: string;
  providers: AuthProviderDescriptor[];
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${controlPlaneBaseUrl}${path}`, {
    credentials: "include",
    cache: "no-store",
    ...init
  });

  if (!response.ok) {
    const maybeJson = await response
      .json()
      .catch(() => ({ message: `${response.status} ${response.statusText}` }));
    const message =
      typeof maybeJson === "object" && maybeJson !== null && "message" in maybeJson
        ? String(maybeJson.message)
        : `${response.status} ${response.statusText}`;
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function fetchAuthProviders(): Promise<AuthProvidersResponse> {
  return apiFetch<AuthProvidersResponse>("/auth/providers");
}

export async function fetchViewerSession(): Promise<ViewerSession | null> {
  try {
    return await apiFetch<ViewerSession>("/auth/session/me");
  } catch {
    return null;
  }
}

export async function fetchBootstrapStatus(): Promise<BootstrapStatus> {
  const response = await fetch(`${controlPlaneBaseUrl}/auth/bootstrap-status`, {
    credentials: "include",
    cache: "no-store"
  });

  if (!response.ok) {
    return {
      initialized: false,
      code: "bootstrap_status_unavailable",
      message: "Unable to load bootstrap status."
    };
  }

  return (await response.json()) as BootstrapStatus;
}

export async function bootstrapAdmin(input: {
  setupToken: string;
  hubName: string;
}): Promise<{ initialized: true; hubId: string; defaultServerId: string; defaultChannelId: string }> {
  return apiFetch("/auth/bootstrap-admin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
}

export async function logout(): Promise<void> {
  await apiFetch("/auth/logout", {
    method: "POST"
  });
}

export async function listServers(): Promise<Server[]> {
  const json = await apiFetch<{ items: Server[] }>("/v1/servers");
  return json.items;
}

export async function listChannels(serverId: string): Promise<Channel[]> {
  const json = await apiFetch<{ items: Channel[] }>(`/v1/servers/${encodeURIComponent(serverId)}/channels`);
  return json.items;
}

export async function listMessages(channelId: string): Promise<ChatMessage[]> {
  const json = await apiFetch<{ items: ChatMessage[] }>(
    `/v1/channels/${encodeURIComponent(channelId)}/messages?limit=100`
  );
  return json.items;
}

export async function sendMessage(channelId: string, content: string): Promise<ChatMessage> {
  return apiFetch(`/v1/channels/${encodeURIComponent(channelId)}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content })
  });
}

export function providerLoginUrl(provider: string, username?: string): string {
  if (provider === "dev") {
    const query = username ? `?username=${encodeURIComponent(username)}` : "";
    return `${controlPlaneBaseUrl}/auth/dev-login${query}`;
  }

  return `${controlPlaneBaseUrl}/auth/login/${encodeURIComponent(provider)}`;
}
