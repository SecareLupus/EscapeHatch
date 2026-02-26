"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { fetchChannelSettings, updateChannelSettings } from "../../../../lib/control-plane";
import { useChat } from "../../../../context/chat-context";
import { useToast } from "../../../../components/toast-provider";

export default function RoomSettingsPage() {
    const params = useParams();
    const channelId = params.id as string;
    const { state } = useChat();
    const { channels } = state;
    const { showToast } = useToast();
    const [settings, setSettings] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const channel = channels.find(c => c.id === channelId);

    useEffect(() => {
        if (!channelId || !channel?.serverId) return;
        async function load() {
            try {
                const s = await fetchChannelSettings(channelId, channel!.serverId);
                setSettings(s);
            } catch (err) {
                console.error("Failed to load room settings", err);
            } finally {
                setLoading(false);
            }
        }
        void load();
    }, [channelId, channel?.serverId]);

    const handleSave = async () => {
        if (!channelId || !channel?.serverId || !settings) return;
        setSaving(true);
        try {
            await updateChannelSettings(channelId, {
                ...settings,
                serverId: channel.serverId
            });
            showToast("Room settings saved", "success");
        } catch (err) {
            showToast("Failed to save room settings", "error");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <p>Loading room settings...</p>;
    if (!channel) return <p>Room not found.</p>;

    return (
        <div className="settings-section">
            <h2>Room Settings: #{channel.name}</h2>
            <p className="settings-description">Configure access and visibility for this specific room.</p>

            <div className="settings-grid" style={{ marginTop: '2rem' }}>
                <section className="settings-row">
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                        <input
                            type="checkbox"
                            checked={settings?.restrictedVisibility || false}
                            onChange={(e) => setSettings({ ...settings, restrictedVisibility: e.target.checked })}
                            style={{ width: '1.2rem', height: '1.2rem' }}
                        />
                        <span>Restricted Visibility</span>
                    </label>
                    <p className="settings-description">Only specific roles will be able to see this room.</p>
                </section>

                {settings?.restrictedVisibility && (
                    <section className="settings-row" style={{ marginTop: '0.5rem' }}>
                        <label>Allowed Role IDs</label>
                        <input
                            className="filter-input"
                            placeholder="e.g. role_admin, role_moderator"
                            value={settings?.allowedRoleIds?.join(", ") || ""}
                            onChange={(e) => setSettings({ 
                                ...settings, 
                                allowedRoleIds: e.target.value.split(",").map(s => s.trim()).filter(Boolean) 
                            })}
                        />
                        <p className="settings-description">Enter role IDs separated by commas.</p>
                    </section>
                )}

                <button 
                    onClick={handleSave} 
                    disabled={saving}
                    style={{ justifySelf: 'start', marginTop: '1rem' }}
                >
                    {saving ? "Saving..." : "Save Changes"}
                </button>
            </div>
        </div>
    );
}
