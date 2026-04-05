"use client";

import { useState, useRef, useEffect } from "react";
import { CodeEditor } from "../code-editor";
import { IconPicker } from "../icon-picker";
import { LandingPageView } from "../landing-page-view";
import { ThemeEngine } from "../theme-engine";
import { LANDING_PAGE_TEMPLATES } from "../../lib/landing-page-templates";
import { getChannelIcon } from "../../lib/channel-utils";
import { uploadMedia } from "../../lib/control-plane";
import type { Channel, ChannelType } from "@skerry/shared";
import { useToast } from "../toast-provider";

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(" ");
}

interface CreatorSuiteProps {
  serverId: string;
  channels: Channel[];
  renameRoomId: string;
  renameRoomName: string;
  renameRoomType: ChannelType;
  renameRoomCategoryId: string | null;
  renameRoomTopic: string;
  renameRoomIconUrl: string | null;
  renameRoomStyleContent: string | null;
  dispatch: (action: any) => void;
  handleRenameRoom: (event: React.FormEvent) => Promise<void>;
  moveChannelPosition: (id: string, direction: "up" | "down") => Promise<void>;
  performDeleteRoom: (serverId: string, roomId: string) => Promise<void>;
  mutatingStructure: boolean;
}

export function CreatorSuite({
  serverId,
  channels,
  renameRoomId,
  renameRoomName,
  renameRoomType,
  renameRoomCategoryId,
  renameRoomTopic,
  renameRoomIconUrl,
  renameRoomStyleContent,
  dispatch,
  handleRenameRoom,
  moveChannelPosition,
  performDeleteRoom,
  mutatingStructure
}: CreatorSuiteProps) {
  const { showToast } = useToast();
  const [previewWidth, setPreviewWidth] = useState<number>(600);
  const [isPreviewCollapsed, setIsPreviewCollapsed] = useState<boolean>(false);
  const [isGuideOpen, setIsGuideOpen] = useState<boolean>(false);
  const isResizingRef = useRef(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return;
      const modal = document.querySelector(".modal-panel.wide-layout");
      if (modal) {
        const rect = modal.getBoundingClientRect();
        const newWidth = rect.right - e.clientX;
        setPreviewWidth(Math.max(300, Math.min(newWidth, rect.width - 400)));
      }
    };

    const handleMouseUp = () => {
      isResizingRef.current = false;
      document.body.style.cursor = "default";
      document.querySelectorAll(".creator-resizer").forEach(r => r.classList.remove("active"));
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  return (
    <div className={cn("stack", "creator-layout")} style={{ height: 'calc(100vh - 200px)', minHeight: '600px' }}>
      <div style={{ display: 'flex', gap: '2rem', height: '100%', overflow: 'hidden' }}>
        {/* Left Side: Editor */}
        <div className="stack scroll-container scrollable-pane" style={{ flex: '1', minWidth: '350px', overflowY: 'auto' }}>
          <div className="stack" style={{ gap: '1.5rem', padding: '1.5rem' }}>
            <form className="stack" onSubmit={handleRenameRoom}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ margin: 0 }}>Editing Landing Page: <strong>{channels.find(c => c.id === renameRoomId)?.name}</strong></p>
                <button 
                  type="button" 
                  className="ghost"
                  onClick={() => setIsPreviewCollapsed(!isPreviewCollapsed)}
                  style={{ fontSize: '0.8rem', padding: '4px 8px' }}
                >
                  {isPreviewCollapsed ? "Show Preview" : "Hide Preview"}
                </button>
              </div>
              <div className="stack" style={{ gap: '1rem', background: 'var(--surface-alt)', padding: '1rem', borderRadius: '12px' }}>
                <label htmlFor="rename-room-modal">Room Name</label>
                <input
                  id="rename-room-modal"
                  value={renameRoomName}
                  onChange={(e) => dispatch({ type: "SET_RENAME_ROOM", payload: { id: renameRoomId, name: e.target.value, type: renameRoomType } })}
                  minLength={2}
                  maxLength={80}
                  required
                />

                <label>Room Icon</label>
                <IconPicker 
                  value={renameRoomIconUrl || ""} 
                  onChange={(val) => dispatch({ type: "SET_RENAME_ROOM", payload: { id: renameRoomId, iconUrl: val } })} 
                  defaultIcon={getChannelIcon({ type: renameRoomType } as Channel)}
                />

                <label htmlFor="rename-room-template">Start from Template</label>
                <select 
                  id="rename-room-template" 
                  value="" 
                  onChange={(e) => {
                    const template = LANDING_PAGE_TEMPLATES.find(t => t.id === e.target.value);
                    if (template && confirm(`Are you sure? This will overwrite your current content and style for "${template.name}".`)) {
                      dispatch({ 
                        type: "SET_RENAME_ROOM", 
                        payload: { 
                          id: renameRoomId, 
                          name: renameRoomName, 
                          type: renameRoomType, 
                          categoryId: renameRoomCategoryId, 
                          topic: template.html, 
                          iconUrl: renameRoomIconUrl,
                          styleContent: template.css 
                        } 
                      });
                    }
                  }}
                >
                  <option value="" disabled>Select a template...</option>
                  {LANDING_PAGE_TEMPLATES.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              
              <div className="creator-guide" style={{ marginBottom: '1.5rem' }}>
                <button 
                  type="button" 
                  className="ghost guide-toggle" 
                  onClick={() => setIsGuideOpen(!isGuideOpen)}
                  style={{ width: '100%', justifyContent: 'space-between', padding: '0.6rem 1rem', borderRadius: isGuideOpen ? '12px 12px 0 0' : '12px' }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1.1rem' }}>📖</span> 
                    <strong>Style & Variable Guide</strong>
                  </span>
                  <span>{isGuideOpen ? '▼' : '▶'}</span>
                </button>
                
                {isGuideOpen && (
                  <div className="guide-content stack" style={{ gap: '1rem', padding: '1.25rem', background: 'var(--surface-alt)', borderRadius: '0 0 12px 12px', border: '1px solid var(--border)', borderTop: 'none', fontSize: '0.85rem' }}>
                    <div className="stack" style={{ gap: '0.6rem' }}>
                      <h4 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--accent)' }}>Interpolation Tokens</h4>
                      <p style={{ margin: 0, opacity: 0.8 }}>Use these in your HTML to display dynamic content:</p>
                      <div className="guide-grid">
                        <code>{"{{hubName}}"}</code> <span>Site/Hub name</span>
                        <code>{"{{serverName}}"}</code> <span>Room/Space name</span>
                        <code>{"{{viewerName}}"}</code> <span>Visitor name</span>
                        <code>{"{{memberCount}}"}</code> <span>Total members</span>
                      </div>
                    </div>

                    <div className="stack" style={{ gap: '0.6rem' }}>
                      <h4 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--accent)' }}>Design Tokens (CSS)</h4>
                      <p style={{ margin: 0, opacity: 0.8 }}>Use these for theme-aware styling:</p>
                      <div className="guide-grid">
                        <code>var(--sk-accent)</code> <span>Primary accent</span>
                        <code>var(--sk-text)</code> <span>Primary text</span>
                        <code>var(--sk-bg)</code> <span>App background</span>
                        <code>var(--sk-surface)</code> <span>Surface layer</span>
                      </div>
                    </div>

                    <div className="stack" style={{ gap: '0.6rem' }}>
                      <h4 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--accent)' }}>Custom Components</h4>
                      <div className="guide-grid">
                        <code>&lt;skerry-join-button&gt;</code> <span>Interactive join button</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <label>Landing Page HTML</label>
              <CodeEditor 
                value={renameRoomTopic} 
                onChange={(val) => dispatch({ type: "SET_RENAME_ROOM", payload: { id: renameRoomId, name: renameRoomName, type: renameRoomType, topic: val } })} 
                language="html"
                placeholder="<h1>Welcome</h1>"
                onUploadImage={async () => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = 'image/*';
                  return new Promise((resolve) => {
                    input.onchange = async () => {
                      if (input.files?.[0]) {
                        try {
                          const upload = await uploadMedia(serverId, input.files[0]);
                          resolve(upload.url);
                        } catch (err) {
                            showToast("Image upload failed", "error");
                            resolve(null);
                        }
                      } else {
                        resolve(null);
                      }
                    };
                    input.click();
                  });
                }}
              />

              <label>Landing Page CSS (Optional)</label>
              <CodeEditor 
                value={renameRoomStyleContent || ""} 
                onChange={(val) => dispatch({ type: "SET_RENAME_ROOM", payload: { id: renameRoomId, name: renameRoomName, type: renameRoomType, styleContent: val } })} 
                language="css"
                placeholder=".landing-page { color: gold; }"
              />

              <label htmlFor="rename-room-type">Room Type</label>
              <select
                id="rename-room-type"
                value={renameRoomType}
                onChange={(e) => dispatch({ type: "SET_RENAME_ROOM", payload: { id: renameRoomId, name: renameRoomName, type: e.target.value as any } })}
              >
                <option value="text">Text Room</option>
                <option value="announcement">Announcement Room</option>
                <option value="forum">Forum Room</option>
                <option value="voice">Voice Room</option>
                <option value="landing">Landing Page</option>
              </select>

              <button type="submit" disabled={mutatingStructure} style={{ padding: '1rem', fontSize: '1.1rem' }}>Save Changes</button>
            </form>

            <div className="constrained-stack" style={{ borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
              <p>Room Organization</p>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  type="button"
                  disabled={mutatingStructure}
                  onClick={() => moveChannelPosition(renameRoomId, "up")}
                >
                  Move Up
                </button>
                <button
                  type="button"
                  disabled={mutatingStructure}
                  onClick={() => moveChannelPosition(renameRoomId, "down")}
                >
                  Move Down
                </button>
              </div>
            </div>

            <div className="constrained-stack" style={{ borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
              <p>Danger Zone</p>
              <button
                type="button"
                className="danger"
                disabled={mutatingStructure}
                onClick={() => {
                  if (confirm(`Are you sure you want to delete the room "${renameRoomName}"? All messages and content will be lost.`)) {
                    void performDeleteRoom(serverId, renameRoomId);
                    dispatch({ type: "SET_ACTIVE_MODAL", payload: null });
                  }
                }}
              >
                Delete Room
              </button>
            </div>
          </div>
        </div>

        {/* Resizer Handle */}
        {!isPreviewCollapsed && (
          <div 
            className="creator-resizer" 
            onMouseDown={(e) => {
              e.preventDefault();
              isResizingRef.current = true;
              document.body.style.cursor = "col-resize";
              (e.currentTarget as HTMLElement).classList.add("active");
            }}
          />
        )}

        {/* Right Side: Live Preview */}
        <div 
          className="live-preview-pane" 
          style={{ 
            width: isPreviewCollapsed ? '0px' : `${previewWidth}px`,
            flex: isPreviewCollapsed ? 'none' : 'none',
            minWidth: isPreviewCollapsed ? '0px' : '300px',
            borderLeft: isPreviewCollapsed ? 'none' : '1px solid var(--border)'
          }}
        >
          <div className="preview-header" style={{ padding: '0.75rem 1rem', background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', whiteSpace: 'nowrap' }}>
            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Live Preview</span>
            <button 
              className="ghost" 
              type="button"
              onClick={() => setIsPreviewCollapsed(true)}
              style={{ fontSize: '1.2rem', padding: '0 4px', lineHeight: 1 }}
            >
              ×
            </button>
          </div>
          <div className="preview-content preview-theme-root">
            <ThemeEngine key={`theme-engine-${serverId}`} scopeSelector=".preview-theme-root" />
            <LandingPageView 
              key={`preview-${renameRoomTopic.length}-${renameRoomStyleContent?.length}`}
              topic={renameRoomTopic} 
              styleContent={renameRoomStyleContent} 
              serverId={serverId} 
            />
          </div>
        </div>
      </div>
    </div>
  );
}
