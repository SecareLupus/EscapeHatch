"use client";

import { useRef } from "react";
import { PermissionsEditor } from "../permissions-editor";
import { updateServerSettings } from "../../lib/control-plane";
import type { Server } from "@skerry/shared";

const cn = (...classes: (string | boolean | undefined)[]) => classes.filter(Boolean).join(" ");

interface SpaceModalsProps {
  activeModal: string | null;
  spaceSettingsTab: "general" | "permissions";
  setSpaceSettingsTab: (tab: "general" | "permissions") => void;
  spaceName: string;
  setSpaceName: (name: string) => void;
  renameSpaceId: string;
  renameSpaceName: string;
  renameSpaceIconUrl: string | null;
  iconFile: File | null;
  setIconFile: (file: File | null) => void;
  mutatingStructure: boolean;
  activeServer?: Server;
  handleCreateSpace: (e: React.FormEvent) => Promise<void>;
  handleRenameSpace: (e: React.FormEvent) => Promise<void>;
  dispatch: (action: any) => void;
  showToast: (message: string, type: "success" | "error") => void;
  refreshChatState: () => Promise<void>;
}

export function SpaceModals({
  activeModal,
  spaceSettingsTab,
  setSpaceSettingsTab,
  spaceName,
  setSpaceName,
  renameSpaceId,
  renameSpaceName,
  renameSpaceIconUrl,
  iconFile,
  setIconFile,
  mutatingStructure,
  activeServer,
  handleCreateSpace,
  handleRenameSpace,
  dispatch,
  showToast,
  refreshChatState
}: SpaceModalsProps) {
  const iconInputRef = useRef<HTMLInputElement>(null);

  if (activeModal === "create-space") {
    return (
      <form className="stack" onSubmit={(event) => {
        void handleCreateSpace(event);
        dispatch({ type: "SET_ACTIVE_MODAL", payload: null });
      }}>
        <label htmlFor="space-name-modal">Space Name</label>
        <input
          id="space-name-modal"
          autoFocus
          value={spaceName}
          onChange={(e) => setSpaceName(e.target.value)}
          minLength={2}
          maxLength={80}
          required
        />
        <button type="submit" disabled={mutatingStructure}>Create Space</button>
      </form>
    );
  }

  if (activeModal === "rename-space") {
    return (
      <div className="stack">
        <div className="tabs">
          <button 
            className={cn("tab-button", spaceSettingsTab === "general" && "active")}
            onClick={() => setSpaceSettingsTab("general")}
          >
            General
          </button>
          <button 
            className={cn("tab-button", spaceSettingsTab === "permissions" && "active")}
            onClick={() => setSpaceSettingsTab("permissions")}
          >
            Permissions
          </button>
        </div>

        {spaceSettingsTab === "general" ? (
          <form className="constrained-stack" onSubmit={(event) => {
            void handleRenameSpace(event);
            dispatch({ type: "SET_ACTIVE_MODAL", payload: null });
          }}>
            <label htmlFor="rename-space-modal">New Space Name</label>
            <input
              id="rename-space-modal"
              autoFocus
              value={renameSpaceName}
              onChange={(e) => dispatch({ type: "SET_RENAME_SPACE", payload: { id: renameSpaceId, name: e.target.value } })}
              minLength={2}
              maxLength={80}
              required
            />

            <div className="form-section">
              <label>Space Icon</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.5rem' }}>
                <div className="server-icon-placeholder" style={{ width: '64px', height: '64px', fontSize: '1.5rem' }}>
                  {iconFile ? (
                    <img src={URL.createObjectURL(iconFile)} alt="" className="server-icon-image" />
                  ) : renameSpaceIconUrl ? (
                    <img src={renameSpaceIconUrl} alt="" className="server-icon-image" />
                  ) : (
                    renameSpaceName.charAt(0).toUpperCase() || '?'
                  )}
                </div>
                <div className="constrained-stack" style={{ gap: '0.4rem' }}>
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => iconInputRef.current?.click()}
                  >
                    {renameSpaceIconUrl || iconFile ? 'Change Icon' : 'Upload Icon'}
                  </button>
                  {(renameSpaceIconUrl || iconFile) && (
                    <button
                      type="button"
                      className="ghost"
                      style={{ color: 'var(--danger)' }}
                      onClick={() => {
                        setIconFile(null);
                        dispatch({ type: "SET_RENAME_SPACE", payload: { id: renameSpaceId, name: renameSpaceName, iconUrl: null } });
                      }}
                    >
                      Remove Icon
                    </button>
                  )}
                </div>
                <input
                  type="file"
                  ref={iconInputRef}
                  style={{ display: 'none' }}
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setIconFile(file);
                  }}
                />
              </div>
            </div>
            <button type="submit" disabled={mutatingStructure}>Save Changes</button>
          </form>
        ) : (
          <PermissionsEditor 
            serverId={renameSpaceId}
            initialAccess={{
              hubAdminAccess: activeServer?.hubAdminAccess ?? 'chat',
              spaceMemberAccess: activeServer?.spaceMemberAccess ?? 'chat',
              hubMemberAccess: activeServer?.hubMemberAccess ?? 'chat',
              visitorAccess: activeServer?.visitorAccess ?? 'hidden',
              joinPolicy: activeServer?.joinPolicy
            }}
            onSaveDefaults={async (access) => {
              await updateServerSettings(renameSpaceId, access);
              showToast("Permissions updated", "success");
              void refreshChatState();
            }}
          />
        )}
      </div>
    );
  }

  return null;
}
