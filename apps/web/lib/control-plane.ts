const controlPlaneBaseUrl = process.env.NEXT_PUBLIC_CONTROL_PLANE_URL ?? "http://localhost:4000";

export interface ViewerSession {
  productUserId: string;
  identity: {
    provider: string;
    preferredUsername: string | null;
    email: string | null;
  } | null;
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

export function discordLoginUrl(): string {
  return `${controlPlaneBaseUrl}/auth/login/discord`;
}
