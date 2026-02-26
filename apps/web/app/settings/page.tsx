"use client";

import { useEffect, useState, useMemo } from "react";
import {
    fetchAuthProviders,
    fetchViewerSession,
    providerLinkUrl,
    type AuthProvidersResponse,
    type ViewerSession
} from "../../lib/control-plane";

export default function UserSettingsPage() {
    const [viewer, setViewer] = useState<ViewerSession | null>(null);
    const [providers, setProviders] = useState<AuthProvidersResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function load() {
            try {
                const [v, p] = await Promise.all([
                    fetchViewerSession(),
                    fetchAuthProviders()
                ]);
                setViewer(v);
                setProviders(p);
            } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to load settings");
            } finally {
                setLoading(false);
            }
        }
        void load();
    }, []);

    const enabledLoginProviders = useMemo(
        () => (providers?.providers ?? []).filter((provider) => provider.isEnabled && provider.provider !== "dev"),
        [providers]
    );

    if (loading) return <p>Loading your settings...</p>;
    if (!viewer) return <p>Please sign in to access settings.</p>;

    return (
        <div className="settings-section">
            <h2>User Settings</h2>
            {error ? <p className="error">{error}</p> : null}

            <div className="settings-grid">
                <section>
                    <h3>Connected Accounts</h3>
                    <p className="settings-description">
                        Manage your linked identities and authentication methods.
                    </p>
                    <ul className="settings-list" style={{ marginTop: '1rem' }}>
                        {viewer.linkedIdentities.map((identity) => (
                            <li key={`${identity.provider}:${identity.oidcSubject}`}>
                                <div className="identity-info">
                                    <strong>{identity.provider}</strong>
                                    {identity.email ? <span>{identity.email}</span> : null}
                                </div>
                            </li>
                        ))}
                    </ul>

                    <div className="stack" style={{ marginTop: '1.5rem' }}>
                        <h4>Link More Accounts</h4>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                            {enabledLoginProviders
                                .filter(
                                    (provider) =>
                                        !viewer.linkedIdentities.some((identity) => identity.provider === provider.provider)
                                )
                                .map((provider) => (
                                    <a key={provider.provider} className="button-link" href={providerLinkUrl(provider.provider)}>
                                        Link {provider.displayName}
                                    </a>
                                ))}
                        </div>
                        {enabledLoginProviders.filter(
                            (provider) => !viewer.linkedIdentities.some((identity) => identity.provider === provider.provider)
                        ).length === 0 && <p className="muted" style={{ marginTop: '0.5rem' }}>All available providers are already linked.</p>}
                    </div>
                </section>
            </div>
        </div>
    );
}
