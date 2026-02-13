export type IdentityProvider = "discord" | "keycloak" | "google" | "github" | "dev";

export interface IdentityMapping {
  id: string;
  provider: IdentityProvider;
  oidcSubject: string;
  email: string | null;
  preferredUsername: string | null;
  avatarUrl: string | null;
  matrixUserId: string | null;
  productUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProductSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  provider: IdentityProvider;
}

export interface AuthenticatedViewer {
  productUserId: string;
  identity: Pick<
    IdentityMapping,
    "provider" | "oidcSubject" | "email" | "preferredUsername" | "avatarUrl" | "matrixUserId"
  >;
}

export interface AccountLinkingRequirement {
  provider: IdentityProvider;
  displayName: string;
  isEnabled: boolean;
  requiresReauthentication: boolean;
}
