import type { Category, Channel, ChannelType, ChatMessage, Hub, Server } from "@escapehatch/shared";

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

export interface ViewerRoleBinding {
  role: "hub_operator" | "creator_admin" | "creator_moderator" | "member";
  hubId: string | null;
  serverId: string | null;
  channelId: string | null;
}

export type PrivilegedAction =
  | "moderation.kick"
  | "moderation.ban"
  | "moderation.unban"
  | "moderation.timeout"
  | "moderation.redact"
  | "channel.lock"
  | "channel.unlock"
  | "channel.slowmode"
  | "channel.posting"
  | "voice.token.issue"
  | "reports.triage"
  | "audit.read";

export class ControlPlaneApiError extends Error {
  readonly statusCode: number;
  readonly code?: string;
  readonly requestId?: string;

  constructor(input: { message: string; statusCode: number; code?: string; requestId?: string }) {
    super(input.message);
    this.name = "ControlPlaneApiError";
    this.statusCode = input.statusCode;
    this.code = input.code;
    this.requestId = input.requestId;
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${controlPlaneBaseUrl}${path}`, {
    credentials: "include",
    cache: "no-store",
    ...init
  });

  if (!response.ok) {
    const fallbackMessage = `${response.status} ${response.statusText}`;
    const maybeJson = (await response
      .json()
      .catch(() => ({ message: fallbackMessage }))) as
      | { message?: unknown; code?: unknown; requestId?: unknown }
      | null;

    const message =
      typeof maybeJson === "object" && maybeJson !== null && "message" in maybeJson
        ? String(maybeJson.message)
        : fallbackMessage;
    const code =
      typeof maybeJson === "object" && maybeJson !== null && "code" in maybeJson
        ? String(maybeJson.code)
        : undefined;
    const requestIdFromBody =
      typeof maybeJson === "object" && maybeJson !== null && "requestId" in maybeJson
        ? String(maybeJson.requestId)
        : undefined;
    const requestId = requestIdFromBody ?? response.headers.get("x-request-id") ?? undefined;
    const decoratedMessage = requestId ? `${message} (request ${requestId})` : message;

    throw new ControlPlaneApiError({
      message: decoratedMessage,
      statusCode: response.status,
      code,
      requestId
    });
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

export async function listHubs(): Promise<Hub[]> {
  const json = await apiFetch<{ items: Hub[] }>("/v1/hubs");
  return json.items;
}

export async function listViewerRoleBindings(): Promise<ViewerRoleBinding[]> {
  const json = await apiFetch<{ items: ViewerRoleBinding[] }>("/v1/me/roles");
  return json.items;
}

export async function listChannels(serverId: string): Promise<Channel[]> {
  const json = await apiFetch<{ items: Channel[] }>(`/v1/servers/${encodeURIComponent(serverId)}/channels`);
  return json.items;
}

export async function listCategories(serverId: string): Promise<Category[]> {
  const json = await apiFetch<{ items: Category[] }>(
    `/v1/servers/${encodeURIComponent(serverId)}/categories`
  );
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

export async function createServer(input: { hubId: string; name: string }): Promise<Server> {
  return apiFetch<Server>("/v1/servers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
}

export async function createChannel(input: {
  serverId: string;
  name: string;
  type: ChannelType;
  categoryId?: string;
}): Promise<Channel> {
  return apiFetch<Channel>("/v1/channels", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
}

export async function createCategory(input: {
  serverId: string;
  name: string;
}): Promise<Category> {
  return apiFetch<Category>("/v1/categories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
}

export async function renameCategory(input: {
  categoryId: string;
  serverId: string;
  name: string;
}): Promise<Category> {
  return apiFetch<Category>(`/v1/categories/${encodeURIComponent(input.categoryId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      serverId: input.serverId,
      name: input.name
    })
  });
}

export async function moveChannelCategory(input: {
  channelId: string;
  serverId: string;
  categoryId: string | null;
}): Promise<Channel> {
  return apiFetch<Channel>(`/v1/channels/${encodeURIComponent(input.channelId)}/category`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      serverId: input.serverId,
      categoryId: input.categoryId
    })
  });
}

export async function renameServer(input: { serverId: string; name: string }): Promise<Server> {
  return apiFetch<Server>(`/v1/servers/${encodeURIComponent(input.serverId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: input.name })
  });
}

export async function deleteServer(serverId: string): Promise<void> {
  await apiFetch(`/v1/servers/${encodeURIComponent(serverId)}`, {
    method: "DELETE"
  });
}

export async function renameChannel(input: {
  channelId: string;
  serverId: string;
  name: string;
}): Promise<Channel> {
  return apiFetch<Channel>(`/v1/channels/${encodeURIComponent(input.channelId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      serverId: input.serverId,
      name: input.name
    })
  });
}

export async function deleteChannel(input: { channelId: string; serverId: string }): Promise<void> {
  const query = new URLSearchParams({ serverId: input.serverId });
  await apiFetch(`/v1/channels/${encodeURIComponent(input.channelId)}?${query.toString()}`, {
    method: "DELETE"
  });
}

export async function fetchAllowedActions(serverId: string, channelId?: string): Promise<PrivilegedAction[]> {
  const query = new URLSearchParams({ serverId });
  if (channelId) {
    query.set("channelId", channelId);
  }

  const json = await apiFetch<{ items: PrivilegedAction[] }>(`/v1/permissions?${query.toString()}`);
  return json.items;
}

export async function updateChannelControls(input: {
  channelId: string;
  serverId: string;
  reason: string;
  lock?: boolean;
  slowModeSeconds?: number;
}): Promise<void> {
  await apiFetch(`/v1/channels/${encodeURIComponent(input.channelId)}/controls`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      serverId: input.serverId,
      reason: input.reason,
      ...(typeof input.lock === "boolean" ? { lock: input.lock } : {}),
      ...(typeof input.slowModeSeconds === "number" ? { slowModeSeconds: input.slowModeSeconds } : {})
    })
  });
}

export function connectMessageStream(
  channelId: string,
  handlers: {
    onOpen?: () => void;
    onError?: () => void;
    onMessageCreated: (message: ChatMessage) => void;
  }
): () => void {
  const streamUrl = `${controlPlaneBaseUrl}/v1/channels/${encodeURIComponent(channelId)}/stream`;
  const source = new EventSource(streamUrl, { withCredentials: true });

  source.onopen = () => {
    handlers.onOpen?.();
  };

  source.onerror = () => {
    handlers.onError?.();
  };

  source.addEventListener("message.created", (event) => {
    const payload = JSON.parse((event as MessageEvent<string>).data) as ChatMessage;
    handlers.onMessageCreated(payload);
  });

  return () => {
    source.close();
  };
}

export function providerLoginUrl(provider: string, username?: string): string {
  if (provider === "dev") {
    const query = username ? `?username=${encodeURIComponent(username)}` : "";
    return `${controlPlaneBaseUrl}/auth/dev-login${query}`;
  }

  return `${controlPlaneBaseUrl}/auth/login/${encodeURIComponent(provider)}`;
}
