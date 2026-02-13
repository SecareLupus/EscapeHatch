const controlPlaneBaseUrl = process.env.NEXT_PUBLIC_CONTROL_PLANE_URL ?? "http://localhost:4000";

export interface ViewerSession {
  productUserId: string;
  identity: {
    provider: string;
    preferredUsername: string | null;
    email: string | null;
  } | null;
}

export interface ModerationDashboardSummary {
  queueCount: number;
  latestActions: Array<{ id: string; actionType: string; reason: string; createdAt: string }>;
}

export async function fetchViewerSession(): Promise<ViewerSession | null> {
  try {
    const response = await fetch(`${controlPlaneBaseUrl}/auth/session/me`, {
      credentials: "include",
      cache: "no-store"
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as ViewerSession;
  } catch {
    return null;
  }
}

export async function fetchModerationSummary(serverId: string): Promise<ModerationDashboardSummary | null> {
  try {
    const response = await fetch(`${controlPlaneBaseUrl}/v1/audit-logs?serverId=${encodeURIComponent(serverId)}`, {
      credentials: "include",
      cache: "no-store"
    });

    if (!response.ok) {
      return null;
    }

    const json = (await response.json()) as {
      items: Array<{ id: string; actionType: string; reason: string; createdAt: string }>;
    };

    return {
      queueCount: 0,
      latestActions: json.items.slice(0, 3)
    };
  } catch {
    return null;
  }
}

export function discordLoginUrl(): string {
  return `${controlPlaneBaseUrl}/auth/login/discord`;
}
