"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { fetchServerSettings, updateServerSettings } from "../../../../lib/control-plane";
import { useChat } from "../../../../context/chat-context";
import { useToast } from "../../../../components/toast-provider";
import BridgeManager from "../../../../components/bridge-manager";

export default function SpaceSettingsPage() {
    const params = useParams();
    const serverId = params.id as string;
    const { state } = useChat();
    const { servers, channels } = state;
    const { showToast } = useToast();
    const [settings, setSettings] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const server = servers.find(s => s.id === serverId);

    useEffect(() => {
        if (!serverId) return;
        async function load() {
            try {
                const s = await fetchServerSettings(serverId);
                setSettings(s);
            } catch (err) {
                console.error("Failed to load space settings", err);
            } finally {
                setLoading(false);
            }
        }
        void load();
    }, [serverId]);

    const handleSave = async () => {
        if (!serverId || !settings) return;
        setSaving(true);
        try {
            await updateServerSettings(serverId, settings);
            showToast("Space settings saved", "success");
        } catch (err) {
            showToast("Failed to save space settings", "error");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <p>Loading space settings...</p>;
    if (!server) return <p>Space not found.</p>;

    return (
        <div className="settings-section">
            <h2>Space Settings: {server.name}</h2>
            <p className="settings-description">Manage the configuration for this specific space.</p>

            <div className="settings-grid" style={{ marginTop: '2rem' }}>
                <section className="settings-row">
                    <label>Starting Channel</label>
                    <select
                        className="filter-input"
                        value={settings?.startingChannelId || ""}
                        onChange={(e) => setSettings({ ...settings, startingChannelId: e.target.value || null })}
                    >
                        <option value="">None (Default)</option>
                        {channels.filter(c => c.serverId === serverId).map(c => (
                            <option key={c.id} value={c.id}>#{c.name}</option>
                        ))}
                    </select>
                    <p className="settings-description">The channel users will see first when entering this space.</p>
                </section>

                <section className="settings-row">
                    <label>Visibility</label>
                    <select
                        className="filter-input"
                        value={settings?.visibility || "public"}
                        onChange={(e) => setSettings({ ...settings, visibility: e.target.value })}
                    >
                        <option value="public">Public (Visible to all hub members)</option>
                        <option value="private">Private (Invite only)</option>
                        <option value="hidden">Hidden (Not listed in hub browser)</option>
                    </select>
                </section>

                <section className="settings-row">
                    <label>Visitor Privacy</label>
                    <select
                        className="filter-input"
                        value={settings?.visitorPrivacy || "public"}
                        onChange={(e) => setSettings({ ...settings, visitorPrivacy: e.target.value })}
                    >
                        <option value="public">Public (Visitors can see content)</option>
                        <option value="private">Private (Must be member to see content)</option>
                    </select>
                </section>

                <button 
                    onClick={handleSave} 
                    disabled={saving}
                    style={{ justifySelf: 'start', marginTop: '1rem' }}
                >
                    {saving ? "Saving..." : "Save Changes"}
                </button>
            </div>

            <hr style={{ margin: '3rem 0', border: 'none', borderTop: '1px solid var(--border)' }} />

            <BridgeManager 
                serverId={serverId} 
                hubId={server.hubId} 
                returnTo={`/settings/spaces/${serverId}`}
            />
        </div>
    );
}
