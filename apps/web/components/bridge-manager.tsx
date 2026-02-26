"use client";

import { useState, useEffect, FormEvent } from "react";
import { 
    discordBridgeStartUrl, 
    fetchDiscordBridgeHealth, 
    fetchDiscordBridgePendingSelection, 
    selectDiscordBridgeGuild, 
    retryDiscordBridgeSyncAction, 
    listDiscordBridgeMappings, 
    upsertDiscordBridgeMapping, 
    deleteDiscordBridgeMapping,
    listChannels,
    fetchHubSettings
} from "../lib/control-plane";
import { DiscordBridgeConnection, DiscordBridgeChannelMapping, Channel } from "@escapehatch/shared";
import { useToast } from "./toast-provider";

interface BridgeManagerProps {
    serverId: string;
    hubId: string;
    returnTo?: string;
}

export default function BridgeManager({ serverId, hubId, returnTo }: BridgeManagerProps) {
    const { showToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [bridgeStatus, setBridgeStatus] = useState<{
        connection: DiscordBridgeConnection | null;
        mappingCount: number;
        activeMappingCount: number;
    } | null>(null);
    const [mappings, setMappings] = useState<DiscordBridgeChannelMapping[]>([]);
    const [channels, setChannels] = useState<Channel[]>([]);
    const [discordPendingSelectionId, setDiscordPendingSelectionId] = useState<string | null>(null);
    const [discordGuilds, setDiscordGuilds] = useState<Array<{ id: string; name: string }>>([]);
    const [selectedGuildId, setSelectedGuildId] = useState("");
    const [discordChannelId, setDiscordChannelId] = useState("");
    const [discordChannelName, setDiscordChannelName] = useState("");
    const [matrixChannelId, setMatrixChannelId] = useState("");
    const [hubDisabled, setHubDisabled] = useState(false);

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const pendingId = urlParams.get("discordPendingSelection");
        if (pendingId) {
            setDiscordPendingSelectionId(pendingId);
            void loadPendingSelection(pendingId);
        }
    }, []);

    useEffect(() => {
        if (serverId) {
            void loadState();
        }
    }, [serverId]);

    async function loadState() {
        setLoading(true);
        try {
            const [health, maps, chans, hSettings] = await Promise.all([
                fetchDiscordBridgeHealth(serverId),
                listDiscordBridgeMappings(serverId),
                listChannels(serverId),
                fetchHubSettings(hubId)
            ]);
            setBridgeStatus(health);
            setMappings(maps);
            setChannels(chans);
            setHubDisabled(hSettings.allowSpaceDiscordBridge === false);
        } catch (err) {
            console.error("Failed to load bridge state", err);
            showToast("Failed to load Bridge settings", "error");
        } finally {
            setLoading(false);
        }
    }

    async function loadPendingSelection(pendingId: string) {
        try {
            const res = await fetchDiscordBridgePendingSelection(pendingId);
            setDiscordGuilds(res.guilds);
            if (res.guilds.length > 0) {
                const firstGuild = res.guilds[0];
                if (firstGuild) {
                    setSelectedGuildId(firstGuild.id);
                }
            }
        } catch (err) {
            console.error("Failed to load pending selection", err);
        }
    }

    async function handleRetryBridge() {
        setBusy(true);
        try {
            await retryDiscordBridgeSyncAction(serverId);
            await loadState();
            showToast("Bridge sync retried", "success");
        } catch (err) {
            showToast("Failed to retry bridge sync", "error");
        } finally {
            setBusy(false);
        }
    }

    async function handleSelectGuild(event: FormEvent) {
        event.preventDefault();
        if (!discordPendingSelectionId || !selectedGuildId) return;
        setBusy(true);
        try {
            await selectDiscordBridgeGuild({
                pendingSelectionId: discordPendingSelectionId!,
                guildId: selectedGuildId
            });
            setDiscordPendingSelectionId(null);
            setDiscordGuilds([]);
            // Clear URL param
            const url = new URL(window.location.href);
            url.searchParams.delete("discordPendingSelection");
            window.history.replaceState({}, "", url.toString());
            await loadState();
            showToast("Discord server connected", "success");
        } catch (err) {
            showToast("Failed to confirm guild", "error");
        } finally {
            setBusy(false);
        }
    }

    async function handleUpsertMapping(event: FormEvent) {
        event.preventDefault();
        if (!bridgeStatus?.connection?.guildId) return;
        setBusy(true);
        try {
            await upsertDiscordBridgeMapping({
                serverId,
                guildId: bridgeStatus.connection.guildId,
                discordChannelId,
                discordChannelName,
                matrixChannelId,
                enabled: true
            });
            setDiscordChannelId("");
            setDiscordChannelName("");
            setMatrixChannelId("");
            await loadState();
            showToast("Mapping saved", "success");
        } catch (err) {
            showToast("Failed to save mapping", "error");
        } finally {
            setBusy(false);
        }
    }

    async function handleDeleteMapping(mappingId: string) {
        setBusy(true);
        try {
            await deleteDiscordBridgeMapping({ serverId, mappingId });
            await loadState();
            showToast("Mapping removed", "success");
        } catch (err) {
            showToast("Failed to delete mapping", "error");
        } finally {
            setBusy(false);
        }
    }

    if (loading) return <p>Loading Bridge settings...</p>;

    if (hubDisabled) {
        return (
            <div className="settings-section">
                <h2>Discord Bridge</h2>
                <div className="alert-box warning">
                    <p>Discord Bridge management is currently disabled by the Hub Administrator.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="settings-section">
            <h2>Discord Bridge</h2>
            <p className="settings-description">Connect this Space to a Discord Server to sync messages between platforms.</p>

            <div className="discord-status-panel" style={{ marginTop: '1rem', padding: '1rem', background: 'var(--background-secondary)', borderRadius: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <p style={{ fontWeight: 'bold' }}>Status: <span style={{ color: bridgeStatus?.connection ? 'var(--success)' : 'var(--text-secondary)' }}>{bridgeStatus?.connection?.status ?? "disconnected"}</span></p>
                        {bridgeStatus?.connection?.guildName && (
                            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Server: {bridgeStatus.connection.guildName}</p>
                        )}
                    </div>
                    {serverId && (
                        <a className="button primary" href={discordBridgeStartUrl(serverId, returnTo)}>
                            {bridgeStatus?.connection ? "Change Server" : "Connect Discord"}
                        </a>
                    )}
                </div>
                
                {bridgeStatus?.connection && (
                    <button 
                        type="button" 
                        className="ghost" 
                        disabled={busy} 
                        onClick={handleRetryBridge}
                        style={{ marginTop: '1rem' }}
                    >
                        {busy ? "Syncing..." : "Retry Sync"}
                    </button>
                )}
            </div>

            {discordPendingSelectionId && discordGuilds.length > 0 && (
                <form className="stack" onSubmit={handleSelectGuild} style={{ marginTop: '2rem', padding: '1rem', border: '1px solid var(--accent)' }}>
                    <h3>Complete Connection</h3>
                    <p>Select which Discord server to bridge with:</p>
                    <label htmlFor="guild-select">Discord Server</label>
                    <select
                        id="guild-select"
                        value={selectedGuildId}
                        onChange={(event) => setSelectedGuildId(event.target.value)}
                        className="filter-input"
                    >
                        {discordGuilds.map((guild) => (
                            <option key={guild.id} value={guild.id}>
                                {guild.name}
                            </option>
                        ))}
                    </select>
                    <button type="submit" disabled={busy} className="primary" style={{ marginTop: '1rem' }}>
                        Confirm Selection
                    </button>
                </form>
            )}

            {bridgeStatus?.connection && (
                <div className="settings-grid" style={{ marginTop: '2rem' }}>
                    <h3>Channel Mappings</h3>
                    <form className="stack" onSubmit={handleUpsertMapping}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div className="stack">
                                <label htmlFor="discord-channel-id">Discord Channel ID</label>
                                <input
                                    id="discord-channel-id"
                                    value={discordChannelId}
                                    onChange={(event) => setDiscordChannelId(event.target.value)}
                                    required
                                    placeholder="e.g. 12345678"
                                    className="filter-input"
                                />
                            </div>
                            <div className="stack">
                                <label htmlFor="discord-channel-name">Discord Channel Name</label>
                                <input
                                    id="discord-channel-name"
                                    value={discordChannelName}
                                    onChange={(event) => setDiscordChannelName(event.target.value)}
                                    required
                                    placeholder="e.g. general"
                                    className="filter-input"
                                />
                            </div>
                        </div>
                        <div className="stack" style={{ marginTop: '1rem' }}>
                            <label htmlFor="matrix-channel-id">Hub Room (Internal)</label>
                            <select
                                id="matrix-channel-id"
                                value={matrixChannelId}
                                onChange={(event) => setMatrixChannelId(event.target.value)}
                                required
                                className="filter-input"
                            >
                                <option value="">Select a room...</option>
                                {channels.map((channel) => (
                                    <option key={channel.id} value={channel.id}>
                                        {channel.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <button type="submit" disabled={busy} className="secondary" style={{ marginTop: '1rem', alignSelf: 'start' }}>
                            Add Mapping
                        </button>
                    </form>

                    <div style={{ marginTop: '2rem' }}>
                        <h4>Active Mappings</h4>
                        {mappings.length > 0 ? (
                            <div className="mappings-list stack" style={{ marginTop: '1rem' }}>
                                {mappings.map((mapping) => (
                                    <div key={mapping.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }}>
                                        <div>
                                            <span style={{ fontWeight: 'bold' }}>#{mapping.discordChannelName}</span>
                                            <span style={{ margin: '0 0.5rem', color: 'var(--text-secondary)' }}>↔</span>
                                            <span>{channels.find(c => c.id === mapping.matrixChannelId)?.name || mapping.matrixChannelId}</span>
                                        </div>
                                        <button
                                            type="button"
                                            className="ghost danger small"
                                            onClick={() => {
                                                if (confirm("Remove this mapping?")) {
                                                    void handleDeleteMapping(mapping.id);
                                                }
                                            }}
                                        >
                                            Remove
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="settings-description">No channel mappings configured yet.</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
