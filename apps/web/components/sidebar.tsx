"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { useChat, ModalType } from "../context/chat-context";
import { Channel } from "@escapehatch/shared";

interface SidebarProps {
    handleServerChange: (serverId: string) => Promise<void>;
    handleChannelChange: (channelId: string) => Promise<void>;
    handleServerKeyboardNavigation: (event: React.KeyboardEvent, serverId: string) => void;
    handleChannelKeyboardNavigation: (event: React.KeyboardEvent, channelId: string) => void;
    performDeleteSpace: (serverId: string) => Promise<void>;
    performDeleteRoom: (serverId: string, channelId: string) => Promise<void>;
}

export function Sidebar({
    handleServerChange,
    handleChannelChange,
    handleServerKeyboardNavigation,
    handleChannelKeyboardNavigation,
    performDeleteSpace,
    performDeleteRoom
}: SidebarProps) {
    const { state, dispatch } = useChat();
    const {
        viewerRoles,
        servers,
        channels,
        categories,
        selectedServerId,
        selectedChannelId,
        channelFilter,
        isAddMenuOpen,
        messages,
        lastReadByChannel,
        mentionCountByChannel
    } = state;

    const canManageHub = useMemo(
        () => viewerRoles.some((binding) => binding.role === "hub_admin" && (binding.serverId === null || binding.serverId === "" || !binding.serverId)),
        [viewerRoles]
    );

    const canManageCurrentSpace = useMemo(
        () =>
            viewerRoles.some(
                (binding) =>
                    (binding.role === "hub_admin" || binding.role === "space_owner") &&
                    (binding.serverId === selectedServerId || !binding.serverId || binding.serverId === "")
            ),
        [viewerRoles, selectedServerId]
    );

    const unreadCountByChannel = useMemo(() => {
        const counts: Record<string, number> = {};
        for (const channel of channels) {
            const lastRead = lastReadByChannel[channel.id];
            if (!lastRead) {
                counts[channel.id] = 0;
                continue;
            }
            counts[channel.id] = messages.filter(
                (message) => message.channelId === channel.id && message.createdAt > lastRead
            ).length;
        }
        return counts;
    }, [channels, lastReadByChannel, messages]);

    const filteredChannels = useMemo(() => {
        const term = channelFilter.trim().toLowerCase();
        if (!term) return channels;
        return channels.filter((channel) => channel.name.toLowerCase().includes(term));
    }, [channels, channelFilter]);

    const groupedChannels = useMemo(() => {
        const byCategory = new Map<string | null, Channel[]>();
        for (const channel of filteredChannels) {
            const key = channel.categoryId ?? null;
            const bucket = byCategory.get(key) ?? [];
            bucket.push(channel);
            byCategory.set(key, bucket);
        }

        const groups: Array<{ id: string | null; name: string; channels: Channel[] }> = [];
        const uncategorized = byCategory.get(null) ?? [];
        if (uncategorized.length > 0 || canManageCurrentSpace) {
            groups.push({ id: null, name: "", channels: uncategorized });
        }

        for (const category of categories) {
            const channelsForCategory = byCategory.get(category.id) ?? [];
            groups.push({
                id: category.id,
                name: category.name,
                channels: channelsForCategory
            });
        }

        return groups;
    }, [categories, filteredChannels, canManageCurrentSpace]);

    const [view, setView] = React.useState<"servers" | "channels">(selectedServerId ? "channels" : "servers");

    // Sync view with selectedServerId if it changes externally
    React.useEffect(() => {
        if (selectedServerId) {
            setView("channels");
        }
    }, [selectedServerId]);

    const activeServer = useMemo(() => servers.find(s => s.id === selectedServerId), [servers, selectedServerId]);

    return (
        <aside className="unified-sidebar panel">
            {view === "servers" ? (
                <nav className="servers" aria-label="Servers">
                    <div className="category-header">
                        <h2>Servers</h2>
                        {canManageHub && (
                            <button
                                type="button"
                                className="icon-button"
                                aria-label="Create Space"
                                onClick={() => dispatch({ type: "SET_ACTIVE_MODAL", payload: "create-space" })}
                            >
                                +
                            </button>
                        )}
                    </div>

                    <ul>
                        {servers.map((server) => (
                            <li key={server.id}>
                                <div className="list-item-container">
                                    <button
                                        type="button"
                                        className={selectedServerId === server.id ? "list-item active" : "list-item"}
                                        aria-current={selectedServerId === server.id ? "true" : undefined}
                                        onClick={() => {
                                            void handleServerChange(server.id);
                                            setView("channels");
                                        }}
                                        onKeyDown={(event) => {
                                            handleServerKeyboardNavigation(event, server.id);
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span className="server-icon-placeholder">
                                                {server.name.charAt(0).toUpperCase()}
                                            </span>
                                            {server.name}
                                        </div>
                                        {canManageCurrentSpace && selectedServerId === server.id && (
                                            <div className="inline-mgmt persistent">
                                                <button
                                                    type="button"
                                                    className="icon-button"
                                                    title="Edit Server"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        dispatch({ type: "SET_RENAME_SPACE", payload: { id: server.id, name: server.name } });
                                                        dispatch({ type: "SET_ACTIVE_MODAL", payload: "rename-space" });
                                                    }}
                                                >
                                                    ✎
                                                </button>
                                                <button
                                                    type="button"
                                                    className="icon-button danger"
                                                    title="Delete Server"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (confirm(`Are you sure you want to delete "${server.name}"? This cannot be undone.`)) {
                                                            dispatch({ type: "SET_ERROR", payload: null });
                                                            void performDeleteSpace(server.id);
                                                        }
                                                    }}
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        )}
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>

                    <div className="sidebar-settings">
                        {canManageHub && (
                            <Link href="/admin" className="ghost button-link" style={{ width: '100%' }}>
                                Admin Console
                            </Link>
                        )}
                    </div>
                </nav>
            ) : (
                <nav className="channels" aria-label="Channels">
                    <div className="category-header">
                        <div className="header-left">
                            <button
                                type="button"
                                className="back-button"
                                onClick={() => setView("servers")}
                                title="Back to Servers"
                            >
                                ←
                            </button>
                            <h2 className="server-title">{activeServer?.name || "Channels"}</h2>
                        </div>
                        {canManageCurrentSpace && (
                            <>
                                <button
                                    type="button"
                                    className="icon-button"
                                    title="Add..."
                                    onClick={() => dispatch({ type: "SET_ADD_MENU_OPEN", payload: !isAddMenuOpen })}
                                >
                                    +
                                </button>
                                {isAddMenuOpen && (
                                    <div className="add-menu-dropdown">
                                        <button type="button" onClick={() => {
                                            dispatch({ type: "SET_SELECTED_CATEGORY_FOR_CREATE", payload: "" });
                                            dispatch({ type: "SET_ACTIVE_MODAL", payload: "create-room" });
                                            dispatch({ type: "SET_ADD_MENU_OPEN", payload: false });
                                        }}>
                                            New Room
                                        </button>
                                        <button type="button" onClick={() => {
                                            dispatch({ type: "SET_ACTIVE_MODAL", payload: "create-category" });
                                            dispatch({ type: "SET_ADD_MENU_OPEN", payload: false });
                                        }}>
                                            New Category
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    <input
                        aria-label="Filter channels"
                        placeholder="Search channels"
                        className="filter-input"
                        value={channelFilter}
                        onChange={(event) => dispatch({ type: "SET_CHANNEL_FILTER", payload: event.target.value })}
                    />

                    <div className="channel-groups-container">
                        <ul>
                            {groupedChannels.map((group) => (
                                <li key={group.id ?? "uncategorized"}>
                                    {group.id && (
                                        <div className="category-header">
                                            <p className="category-heading">{group.name}</p>
                                            {canManageCurrentSpace && (
                                                <div className="inline-mgmt persistent">
                                                    <button
                                                        type="button"
                                                        className="icon-button"
                                                        title="Create Room"
                                                        onClick={() => {
                                                            dispatch({ type: "SET_SELECTED_CATEGORY_FOR_CREATE", payload: group.id ?? "" });
                                                            dispatch({ type: "SET_ACTIVE_MODAL", payload: "create-room" });
                                                        }}
                                                    >
                                                        +
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="icon-button"
                                                        title="Rename Category"
                                                        onClick={() => {
                                                            dispatch({ type: "SET_RENAME_CATEGORY", payload: { id: group.id!, name: group.name } });
                                                            dispatch({ type: "SET_ACTIVE_MODAL", payload: "rename-category" });
                                                        }}
                                                    >
                                                        ✎
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <ul className="nested-channel-list">
                                        {group.channels.map((channel) => (
                                            <li key={channel.id}>
                                                <button
                                                    type="button"
                                                    className={selectedChannelId === channel.id ? "list-item active" : "list-item"}
                                                    aria-current={selectedChannelId === channel.id ? "true" : undefined}
                                                    onClick={() => {
                                                        void handleChannelChange(channel.id);
                                                    }}
                                                    onKeyDown={(event) => {
                                                        handleChannelKeyboardNavigation(event, channel.id);
                                                    }}
                                                >
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        {channel.type === 'voice' ? '🔊' : '#'}
                                                        {channel.name}
                                                    </span>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        {(unreadCountByChannel[channel.id] ?? 0) > 0 ? (
                                                            <span className="unread-pill">{unreadCountByChannel[channel.id]}</span>
                                                        ) : null}
                                                        {(mentionCountByChannel[channel.id] ?? 0) > 0 ? (
                                                            <span className="mention-pill">@{mentionCountByChannel[channel.id]}</span>
                                                        ) : null}
                                                        {canManageCurrentSpace && selectedChannelId === channel.id && (
                                                            <div className="inline-mgmt">
                                                                <button
                                                                    type="button"
                                                                    className="icon-button"
                                                                    title="Edit Room"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        dispatch({ type: "SET_RENAME_ROOM", payload: { id: channel.id, name: channel.name, type: channel.type, categoryId: channel.categoryId } });
                                                                        dispatch({ type: "SET_ACTIVE_MODAL", payload: "rename-room" });
                                                                    }}
                                                                >
                                                                    ✎
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    className="icon-button danger"
                                                                    title="Delete Room"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        if (confirm(`Are you sure you want to delete "#${channel.name}"?`)) {
                                                                            if (selectedServerId) {
                                                                                void performDeleteRoom(selectedServerId, channel.id);
                                                                            }
                                                                        }
                                                                    }}
                                                                >
                                                                    ×
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                </li>
                            ))}
                        </ul>
                    </div>
                </nav>
            )}
        </aside>
    );
}
