"use client";

import React, { useMemo, useRef, useEffect } from "react";
import { useChat, MessageItem } from "../context/chat-context";
import type { ChatMessage } from "@escapehatch/shared";

interface ChatWindowProps {
    handleSendMessage: (event: React.FormEvent) => Promise<void>;
    handleUpdateSlowMode: (event: React.FormEvent) => Promise<void>;
    handleSetLock: (locked: boolean) => Promise<void>;
    handleMessageListScroll: (event: React.UIEvent<HTMLOListElement>) => void;
    jumpToLatest: () => void;
    submitDraftMessage: () => Promise<void>;
    sendContentWithOptimistic: (content: string, failedId?: string) => Promise<void>;
    handleJoinVoice: () => Promise<void>;
    handleLeaveVoice: () => Promise<void>;
    toggleTheme: () => void;
    handleLogout: () => Promise<void>;
    // UI local states passed down for sync (until moved to context)
    draftMessage: string;
    setDraftMessage: (val: string) => void;
    controlsOpen: boolean;
    setControlsOpen: React.Dispatch<React.SetStateAction<boolean>>;
    slowModeSeconds: string;
    setSlowModeSeconds: (val: string) => void;
    controlsReason: string;
    setControlsReason: (val: string) => void;
    updatingControls: boolean;
    sending: boolean;
    voiceConnected: boolean;
    voiceGrant: any; // Type as needed
    mentions: any[]; // Type as needed
}

function formatMessageTime(value: string): string {
    const date = new Date(value);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function ChatWindow({
    handleSendMessage,
    handleUpdateSlowMode,
    handleSetLock,
    handleMessageListScroll,
    jumpToLatest,
    submitDraftMessage,
    sendContentWithOptimistic,
    handleJoinVoice,
    handleLeaveVoice,
    toggleTheme,
    handleLogout,
    draftMessage,
    setDraftMessage,
    controlsOpen,
    setControlsOpen,
    slowModeSeconds,
    setSlowModeSeconds,
    controlsReason,
    setControlsReason,
    updatingControls,
    sending,
    voiceConnected,
    voiceGrant,
    mentions
}: ChatWindowProps) {
    const { state, dispatch } = useChat();
    const {
        viewer,
        servers,
        channels,
        selectedServerId,
        selectedChannelId,
        activeChannelData,
        messages,
        isNearBottom,
        pendingNewMessageCount,
        isDetailsOpen,
        theme,
        allowedActions
    } = state;

    const messagesRef = useRef<HTMLOListElement | null>(null);
    const messageInputRef = useRef<HTMLTextAreaElement | null>(null);

    const activeChannel = activeChannelData;

    const activeServer = useMemo(
        () => servers.find((s) => s.id === (activeChannel?.serverId ?? selectedServerId)),
        [servers, selectedServerId, activeChannel?.serverId]
    );

    const canManageChannel = useMemo(
        () =>
            allowedActions.includes("channel.lock") ||
            allowedActions.includes("channel.unlock") ||
            allowedActions.includes("channel.slowmode"),
        [allowedActions]
    );

    const renderedMessages = useMemo(() => {
        const grouped: Array<{
            message: MessageItem;
            showHeader: boolean;
            showDateDivider: boolean;
        }> = [];

        for (let index = 0; index < messages.length; index += 1) {
            const message = messages[index]!;
            const previous = messages[index - 1];
            const currentTime = new Date(message.createdAt).getTime();
            const previousTime = previous ? new Date(previous.createdAt).getTime() : null;
            const showHeader =
                !previous ||
                previous.authorUserId !== message.authorUserId ||
                previousTime === null ||
                currentTime - previousTime > 5 * 60 * 1000;

            const showDateDivider =
                !previous ||
                new Date(previous.createdAt).toDateString() !== new Date(message.createdAt).toDateString();

            grouped.push({
                message,
                showHeader,
                showDateDivider
            });
        }

        return grouped;
    }, [messages]);

    return (
        <section className="timeline panel" aria-label="Messages">
            <header className="channel-header">
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <button
                        type="button"
                        className="icon-button mobile-only"
                        onClick={() => dispatch({ type: "SET_SIDEBAR_OPEN", payload: !state.isSidebarOpen })}
                        aria-label="Toggle Sidebar"
                        style={{ display: "none" }} /* Hidden by CSS for desktop */
                    >
                        ☰
                    </button>
                    <div>
                        <h2>{activeServer ? `${activeServer.name} - ` : ""}{activeChannel ? `#${activeChannel.name}` : "No channel selected"}</h2>
                        <p>
                            {activeChannel
                                ? `${messages.length} messages · slow mode ${activeChannel.slowModeSeconds}s`
                                : "Select a channel to start chatting"}
                        </p>
                    </div>
                </div>
                <div className="channel-actions">
                    <span className="channel-badge">{activeChannel?.type ?? "none"}</span>
                    <button
                        type="button"
                        className="icon-button"
                        onClick={toggleTheme}
                        aria-label={theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"}
                    >
                        {theme === "light" ? "🌙" : "☀️"}
                    </button>
                    <button
                        type="button"
                        className="icon-button"
                        onClick={handleLogout}
                        aria-label="Logout"
                        title="Logout"
                    >
                        🚪
                    </button>
                    {canManageChannel && activeChannel ? (
                        <button type="button" className="ghost" onClick={() => setControlsOpen((current) => !current)}>
                            {controlsOpen ? "Close Controls" : "Channel Controls"}
                        </button>
                    ) : null}
                    <button
                        type="button"
                        className="ghost"
                        title={isDetailsOpen ? "Hide Details" : "Show Details"}
                        onClick={() => dispatch({ type: "SET_DETAILS_OPEN", payload: !isDetailsOpen })}
                    >
                        {isDetailsOpen ? "→" : "←"}
                    </button>
                </div>
            </header>

            {controlsOpen && activeChannel ? (
                <section className="channel-controls" aria-label="Channel controls">
                    <div className="controls-row">
                        <button
                            type="button"
                            className="ghost"
                            disabled={updatingControls}
                            onClick={() => {
                                void handleSetLock(!activeChannel.isLocked);
                            }}
                        >
                            {activeChannel.isLocked ? "Unlock Channel" : "Lock Channel"}
                        </button>
                        <span>{activeChannel.isLocked ? "Currently locked" : "Currently unlocked"}</span>
                    </div>
                    <form className="controls-row controls-form" onSubmit={handleUpdateSlowMode}>
                        <label htmlFor="slow-mode-input">Slow mode (seconds)</label>
                        <input
                            id="slow-mode-input"
                            type="number"
                            min={0}
                            max={600}
                            value={slowModeSeconds}
                            onChange={(event) => setSlowModeSeconds(event.target.value)}
                        />
                        <label htmlFor="controls-reason">Reason</label>
                        <input
                            id="controls-reason"
                            value={controlsReason}
                            onChange={(event) => setControlsReason(event.target.value)}
                            minLength={3}
                            required
                        />
                        <button type="submit" disabled={updatingControls}>
                            {updatingControls ? "Saving..." : "Apply Slow Mode"}
                        </button>
                    </form>
                </section>
            ) : null}

            <ol className="messages" ref={messagesRef} onScroll={handleMessageListScroll}>
                {renderedMessages.map(({ message, showHeader, showDateDivider }) => (
                    <li key={message.id}>
                        {showDateDivider ? (
                            <div className="date-divider">
                                <span>{new Date(message.createdAt).toLocaleDateString()}</span>
                            </div>
                        ) : null}
                        <article>
                            {showHeader ? (
                                <header>
                                    <strong>{message.authorDisplayName}</strong>
                                    <time dateTime={message.createdAt}>{formatMessageTime(message.createdAt)}</time>
                                </header>
                            ) : null}
                            <p>{message.content}</p>
                            {message.clientState === "sending" ? <small className="message-meta">Sending...</small> : null}
                            {message.clientState === "failed" ? (
                                <small className="message-meta message-meta-error">
                                    Failed to send.
                                    <button
                                        type="button"
                                        className="inline-action"
                                        onClick={() => {
                                            void sendContentWithOptimistic(message.content, message.id);
                                        }}
                                    >
                                        Retry
                                    </button>
                                </small>
                            ) : null}
                        </article>
                    </li>
                ))}
            </ol>

            {!isNearBottom && pendingNewMessageCount > 0 ? (
                <div className="jump-latest">
                    <button type="button" onClick={jumpToLatest}>
                        Jump to latest ({pendingNewMessageCount})
                    </button>
                </div>
            ) : null}

            <form onSubmit={handleSendMessage} className="composer">
                <label htmlFor="message-input" className="sr-only">
                    Message
                </label>
                <textarea
                    id="message-input"
                    ref={messageInputRef}
                    value={draftMessage}
                    onChange={(event) => setDraftMessage(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                            event.preventDefault();
                            if (draftMessage.trim()) {
                                void submitDraftMessage();
                            }
                        }
                    }}
                    maxLength={2000}
                    placeholder={activeChannel ? `Message #${activeChannel.name}` : "Select a channel first"}
                    aria-label={activeChannel ? `Message #${activeChannel.name}` : "Message channel"}
                    disabled={!activeChannel || sending}
                />
                <div className="composer-actions">
                    <small className="char-count">{draftMessage.length}/2000</small>
                    <button type="submit" disabled={!activeChannel || sending || !draftMessage.trim()}>
                        {sending ? "Sending..." : "Send"}
                    </button>
                </div>
            </form>
        </section>
    );
}
