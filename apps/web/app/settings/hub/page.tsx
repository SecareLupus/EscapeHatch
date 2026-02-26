"use client";

import { useEffect, useState } from "react";
import { fetchHubSettings, updateHubSettings } from "../../../lib/control-plane";
import { useChat } from "../../../context/chat-context";
import { useToast } from "../../../components/toast-provider";

export default function HubSettingsPage() {
    const { state } = useChat();
    const { hubs } = state;
    const { showToast } = useToast();
    const [settings, setSettings] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const hubId = hubs[0]?.id;

    useEffect(() => {
        if (!hubId) return;
        async function load() {
            try {
                const s = await fetchHubSettings(hubId!);
                setSettings(s);
            } catch (err) {
                console.error("Failed to load hub settings", err);
            } finally {
                setLoading(false);
            }
        }
        void load();
    }, [hubId]);

    const handleSave = async () => {
        if (!hubId || !settings) return;
        setSaving(true);
        try {
            await updateHubSettings(hubId, settings);
            showToast("Hub settings saved", "success");
        } catch (err) {
            showToast("Failed to save hub settings", "error");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <p>Loading hub settings...</p>;
    if (!hubId) return <p>No hub found.</p>;

    return (
        <div className="settings-section">
            <h2>Hub Settings</h2>
            <p className="settings-description">Global configuration for the entire Hub.</p>

            <div className="settings-grid" style={{ marginTop: '2rem' }}>
                <section className="settings-row">
                    <label>Hub Theme (JSON)</label>
                    <textarea
                        className="filter-input"
                        style={{ minHeight: '150px', fontFamily: 'monospace', fontSize: '0.8rem' }}
                        defaultValue={JSON.stringify(settings.theme || {}, null, 2)}
                        onBlur={(e) => {
                            try {
                                const theme = JSON.parse(e.target.value);
                                setSettings({ ...settings, theme });
                            } catch {
                                showToast("Invalid JSON in Theme field", "error");
                            }
                        }}
                    />
                    <p className="settings-description">Customize the visual appearance of the hub.</p>
                </section>

                <section className="settings-row">
                    <label>Space Customization Limits (JSON)</label>
                    <textarea
                        className="filter-input"
                        style={{ minHeight: '150px', fontFamily: 'monospace', fontSize: '0.8rem' }}
                        defaultValue={JSON.stringify(settings.spaceCustomizationLimits || {}, null, 2)}
                        onBlur={(e) => {
                            try {
                                const limits = JSON.parse(e.target.value);
                                setSettings({ ...settings, spaceCustomizationLimits: limits });
                            } catch {
                                showToast("Invalid JSON in Limits field", "error");
                            }
                        }}
                    />
                </section>

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
