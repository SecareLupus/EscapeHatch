"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
    fetchAuthProviders,
    fetchViewerSession,
    providerLinkUrl,
    type AuthProvidersResponse,
    type ViewerSession
} from "../../lib/control-plane";

export default function SettingsPage() {
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

    if (loading) {
        return (
            <main className="app">
                <section className="panel">
                    <h1>Settings</h1>
                    <p>Loading your settings...</p>
                </section>
            </main>
        );
    }

    if (!viewer) {
        return (
            <main className="app">
                <section className="panel">
                    <h1>Unauthorized</h1>
                    <p>Please sign in to access settings.</p>
                    <Link href="/" className="button-link">Back to Home</Link>
                </section>
            </main>
        );
    }

    return (
        <main className="app settings-page">
            <header className="topbar">
                <h1>User Settings</h1>
                <div className="topbar-meta">
                    <Link href="/" className="ghost">Back to Chat</Link>
                </div>
            </header>

            {error ? <p className="error">{error}</p> : null}

            <section className="panel">
                <h2>Connected Accounts</h2>
                <p>
                    You have {viewer.linkedIdentities.length} linked provider
                    {viewer.linkedIdentities.length === 1 ? "" : "s"}.
                </p>
                <ul className="settings-list">
                    {viewer.linkedIdentities.map((identity) => (
                        <li key={`${identity.provider}:${identity.oidcSubject}`}>
                            <div className="identity-info">
                                <strong>{identity.provider}</strong>
                                {identity.email ? <span>{identity.email}</span> : null}
                            </div>
                        </li>
                    ))}
                </ul>

                <div className="stack" style={{ marginTop: '1rem' }}>
                    <h3>Link More Accounts</h3>
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
                    {enabledLoginProviders.filter(
                        (provider) => !viewer.linkedIdentities.some((identity) => identity.provider === provider.provider)
                    ).length === 0 && <p className="muted">All available providers are already linked.</p>}
                </div>
            </section>
        </main>
    );
}
