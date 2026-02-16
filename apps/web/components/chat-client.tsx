"use client";

import { FormEvent, KeyboardEvent as ReactKeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { Category, Channel, ChatMessage, MentionMarker, ModerationAction, ModerationReport, Server, VoicePresenceMember, VoiceTokenGrant } from "@escapehatch/shared";
import {
  bootstrapAdmin,
  createReport,
  connectMessageStream,
  completeUsernameOnboarding,
  createCategory,
  createChannel,
  createServer,
  deleteChannel,
  deleteCategory, // Added deleteCategory
  deleteServer,
  issueVoiceTokenWithVideo,
  fetchAllowedActions,
  fetchAuthProviders,
  fetchBootstrapStatus,
  fetchViewerSession,
  listHubs,
  listMentions,
  listAuditLogs,
  listReports,
  listChannelReadStates,
  listCategories,
  listChannels,
  listMessages,
  listServers,
  listViewerRoleBindings,
  joinVoicePresence,
  leaveVoicePresence,
  listVoicePresence,
  moveChannelCategory,
  performModerationAction,
  logout,
  providerLinkUrl,
  providerLoginUrl,
  renameCategory,
  renameChannel,
  renameServer,
  sendMessage,
  transitionReportStatus,
  updateChannelVideoControls,
  upsertChannelReadState,
  updateChannelControls,
  updateUserTheme,
  updateVoicePresenceState,
  type AuthProvidersResponse,
  type BootstrapStatus,
  type ViewerRoleBinding,
  type PrivilegedAction,
  type ViewerSession
} from "../lib/control-plane";

interface MessageItem extends ChatMessage {
  clientState?: "sending" | "failed";
}

function formatMessageTime(value: string): string {
  const date = new Date(value);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function ChatClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlServerId = searchParams.get("server");
  const urlChannelId = searchParams.get("channel");
  const suggestedUsername = searchParams.get("suggestedUsername");

  const [viewer, setViewer] = useState<ViewerSession | null>(null);
  const [providers, setProviders] = useState<AuthProvidersResponse | null>(null);
  const [bootstrapStatus, setBootstrapStatus] = useState<BootstrapStatus | null>(null);
  const [servers, setServers] = useState<Server[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [hubs, setHubs] = useState<Array<{ id: string; name: string }>>([]);
  const [viewerRoles, setViewerRoles] = useState<ViewerRoleBinding[]>([]);
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [setupToken, setSetupToken] = useState("");
  const [hubName, setHubName] = useState("Local Creator Hub");
  const [draftMessage, setDraftMessage] = useState("");
  const [devUsername, setDevUsername] = useState("local-admin");
  const [onboardingUsername, setOnboardingUsername] = useState("");

  useEffect(() => {
    if (suggestedUsername) {
      setOnboardingUsername(suggestedUsername);
    }
  }, [suggestedUsername]);
  const [sending, setSending] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [savingOnboarding, setSavingOnboarding] = useState(false);
  const [realtimeState, setRealtimeState] = useState<"disconnected" | "polling" | "live">("disconnected");
  const [allowedActions, setAllowedActions] = useState<PrivilegedAction[]>([]);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [controlsReason, setControlsReason] = useState("Channel policy update");
  const [slowModeSeconds, setSlowModeSeconds] = useState("0");
  const [updatingControls, setUpdatingControls] = useState(false);
  const [lastReadByChannel, setLastReadByChannel] = useState<Record<string, string>>({});
  const [mentionCountByChannel, setMentionCountByChannel] = useState<Record<string, number>>({});
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [pendingNewMessageCount, setPendingNewMessageCount] = useState(0);
  const [lastSeenMessageId, setLastSeenMessageId] = useState<string | null>(null);
  const [channelFilter, setChannelFilter] = useState("");
  const [spaceName, setSpaceName] = useState("New Space");
  const [roomName, setRoomName] = useState("new-room");
  const [roomType, setRoomType] = useState<"text" | "announcement" | "voice">("text");
  const [selectedHubIdForCreate, setSelectedHubIdForCreate] = useState<string | null>(null);
  const [creatingSpace, setCreatingSpace] = useState(false);
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [categoryName, setCategoryName] = useState("New Category");
  const [selectedCategoryIdForCreate, setSelectedCategoryIdForCreate] = useState<string>("");
  const [renameSpaceId, setRenameSpaceId] = useState<string>("");
  const [renameSpaceName, setRenameSpaceName] = useState("");
  const [renameCategoryId, setRenameCategoryId] = useState<string>("");
  const [renameCategoryName, setRenameCategoryName] = useState("");
  const [renameRoomId, setRenameRoomId] = useState<string>("");
  const [renameRoomName, setRenameRoomName] = useState("");
  const [renameRoomType, setRenameRoomType] = useState<Channel["type"]>("text");
  const [renameRoomCategoryId, setRenameRoomCategoryId] = useState<string | null>(null);
  const [deleteSpaceConfirm, setDeleteSpaceConfirm] = useState("");
  const [deleteTargetSpaceId, setDeleteTargetSpaceId] = useState<string>("");
  const [deleteRoomConfirm, setDeleteRoomConfirm] = useState("");
  const [mutatingStructure, setMutatingStructure] = useState(false);
  const [voiceConnected, setVoiceConnected] = useState(false);
  const [voiceMuted, setVoiceMuted] = useState(false);
  const [voiceDeafened, setVoiceDeafened] = useState(false);
  const [voiceVideoEnabled, setVoiceVideoEnabled] = useState(false);
  const [voiceVideoQuality, setVoiceVideoQuality] = useState<"low" | "medium" | "high">("medium");
  const [voiceGrant, setVoiceGrant] = useState<VoiceTokenGrant | null>(null);
  const [voiceMembers, setVoiceMembers] = useState<VoicePresenceMember[]>([]);
  const [modActionType, setModActionType] = useState<"kick" | "ban" | "unban" | "timeout" | "redact_message">("kick");
  const [modReason, setModReason] = useState("Moderator action");
  const [modTargetUserId, setModTargetUserId] = useState("");
  const [reportReason, setReportReason] = useState("Report reason");
  const [reportTargetUserId, setReportTargetUserId] = useState("");
  const [reports, setReports] = useState<ModerationReport[]>([]);
  const [auditLogs, setAuditLogs] = useState<ModerationAction[]>([]);
  const [mentions, setMentions] = useState<MentionMarker[]>([]);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [activeModal, setActiveModal] = useState<
    "create-space" | "create-category" | "create-room" | "rename-space" | "rename-category" | "rename-room" | null
  >(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(true);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const messagesRef = useRef<HTMLOListElement | null>(null);
  const messageInputRef = useRef<HTMLTextAreaElement | null>(null);
  const chatStateRequestIdRef = useRef(0);
  const initialChatLoadKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const savedTheme = (viewer?.identity?.theme || localStorage.getItem("theme")) as "light" | "dark" | null;
    if (savedTheme) {
      setTheme(savedTheme);
    } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      setTheme("dark");
    }
  }, [viewer?.identity]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "light" ? "dark" : "light";
      void updateUserTheme(next);
      return next;
    });
  }, []);

  const enabledLoginProviders = useMemo(
    () => (providers?.providers ?? []).filter((provider) => provider.isEnabled && provider.provider !== "dev"),
    [providers]
  );
  const canAccessWorkspace = Boolean(viewer && !viewer.needsOnboarding && bootstrapStatus?.initialized);
  const activeChannel = channels.find((channel) => channel.id === selectedChannelId) ?? null;
  const canManageChannel = useMemo(
    () =>
      allowedActions.includes("channel.lock") ||
      allowedActions.includes("channel.unlock") ||
      allowedActions.includes("channel.slowmode"),
    [allowedActions]
  );
  const canManageHub = useMemo(
    () => viewerRoles.some((binding) => binding.role === "hub_admin" && !binding.serverId),
    [viewerRoles]
  );
  const canManageCurrentSpace = useMemo(
    () =>
      viewerRoles.some(
        (binding) =>
          (binding.role === "hub_admin" || binding.role === "space_owner") &&
          (binding.serverId === selectedServerId || !binding.serverId)
      ),
    [viewerRoles, selectedServerId]
  );

  const memberRoster = useMemo(() => {
    const members = new Map<string, string>();
    for (const message of messages) {
      members.set(message.authorUserId, message.authorDisplayName);
    }
    return [...members.entries()].map(([id, displayName]) => ({ id, displayName }));
  }, [messages]);

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
    if (!term) {
      return channels;
    }
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
  }, [categories, filteredChannels]);
  const groupedChannelIds = useMemo(() => {
    return groupedChannels.flatMap((group) => group.channels.map((channel) => channel.id));
  }, [groupedChannels]);

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

  const setUrlSelection = useCallback(
    (serverId: string | null, channelId: string | null) => {
      const currentQuery = searchParams.toString();
      const next = new URLSearchParams(searchParams.toString());
      if (serverId) {
        next.set("server", serverId);
      } else {
        next.delete("server");
      }

      if (channelId) {
        next.set("channel", channelId);
      } else {
        next.delete("channel");
      }

      const query = next.toString();
      if (query === currentQuery) {
        return;
      }
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const refreshAuthState = useCallback(async (): Promise<void> => {
    // We fetch critical auth meta individually to prevent total failure if one service (like DB) is lagging.
    try {
      const providerData = await fetchAuthProviders();
      setProviders(providerData);
    } catch (cause) {
      console.error("Failed to load auth providers:", cause);
      setError(cause instanceof Error ? cause.message : "Failed to load auth providers.");
    }

    const viewerData = await fetchViewerSession();
    setViewer(viewerData);

    try {
      const bootstrapData = await fetchBootstrapStatus();
      setBootstrapStatus(bootstrapData);
    } catch (cause) {
      console.error("Failed to load bootstrap status:", cause);
      // Keep previous status or null on failure.
    }

    void listViewerRoleBindings()
      .then(setViewerRoles)
      .catch(() => setViewerRoles([]));

    void listHubs()
      .then((items) => {
        setHubs(items.map((h) => ({ id: h.id, name: h.name })));
        if (items.length > 0 && items[0]) {
          setSelectedHubIdForCreate(items[0].id);
        }
      })
      .catch(() => setHubs([]));
  }, []);

  const refreshChatState = useCallback(async (preferredServerId?: string, preferredChannelId?: string): Promise<void> => {
    const requestId = ++chatStateRequestIdRef.current;
    const [serverItems, roleBindings] = await Promise.all([
      listServers(),
      listViewerRoleBindings()
    ]);
    if (requestId !== chatStateRequestIdRef.current) {
      return;
    }
    setServers(serverItems);
    setViewerRoles(roleBindings);


    const candidateServerId =
      preferredServerId ??
      urlServerId ??
      selectedServerId ??
      serverItems[0]?.id ??
      null;
    const nextServerId =
      candidateServerId && serverItems.some((server) => server.id === candidateServerId)
        ? candidateServerId
        : (serverItems[0]?.id ?? null);
    setSelectedServerId(nextServerId);

    if (!nextServerId) {
      setChannels([]);
      setCategories([]);
      setSelectedChannelId(null);
      setMessages([]);
      setUrlSelection(null, null);
      return;
    }

    // Immediately clear room/message context while loading next space to avoid cross-space bleed.
    setChannels([]);
    setCategories([]);
    setSelectedChannelId(null);
    setMessages([]);

    const channelItems = await listChannels(nextServerId);
    if (requestId !== chatStateRequestIdRef.current) {
      return;
    }
    const categoryItems = await listCategories(nextServerId);
    if (requestId !== chatStateRequestIdRef.current) {
      return;
    }
    setChannels(channelItems);
    setCategories(categoryItems);

    const textChannels = channelItems.filter((channel) => channel.type === "text" || channel.type === "announcement");
    const candidateChannelId =
      preferredChannelId ??
      urlChannelId ??
      selectedChannelId ??
      textChannels[0]?.id ??
      channelItems[0]?.id ??
      null;
    const nextChannelId =
      candidateChannelId && channelItems.some((channel) => channel.id === candidateChannelId)
        ? candidateChannelId
        : (textChannels[0]?.id ?? channelItems[0]?.id ?? null);
    setSelectedChannelId(nextChannelId);
    setUrlSelection(nextServerId, nextChannelId);

    if (!nextChannelId) {
      setMessages([]);
      return;
    }

    const messageItems = await listMessages(nextChannelId);
    if (requestId !== chatStateRequestIdRef.current) {
      return;
    }
    setMessages(messageItems.map((message) => ({ ...message })));
  }, [selectedServerId, selectedChannelId, setUrlSelection, urlChannelId, urlServerId]);

  const initialize = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      await refreshAuthState();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to load auth state.");
    } finally {
      setLoading(false);
    }
  }, [refreshAuthState]);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  // Potential bug trigger: This effect initializes the chat state (server/channel) based on 
  // bootstrap defaults. If bootstrapStatus or its properties update unexpectedly, this 
  // could reset the user's manual space selection back to the default space.
  useEffect(() => {
    if (!viewer || viewer.needsOnboarding || !bootstrapStatus?.initialized) {
      initialChatLoadKeyRef.current = null;
      return;
    }

    const loadKey = [
      viewer.productUserId,
      bootstrapStatus.defaultServerId ?? "",
      bootstrapStatus.defaultChannelId ?? ""
    ].join(":");
    if (initialChatLoadKeyRef.current === loadKey) {
      return;
    }
    initialChatLoadKeyRef.current = loadKey;

    void refreshChatState(bootstrapStatus.defaultServerId ?? undefined, bootstrapStatus.defaultChannelId ?? undefined).catch(
      (cause) => {
        setError(cause instanceof Error ? cause.message : "Failed to load chat state.");
      }
    );
  }, [viewer, bootstrapStatus?.initialized, bootstrapStatus?.defaultServerId, bootstrapStatus?.defaultChannelId, refreshChatState]);

  useEffect(() => {
    if (!canAccessWorkspace || !selectedServerId) {
      setAllowedActions([]);
      return;
    }

    void fetchAllowedActions(selectedServerId, selectedChannelId ?? undefined)
      .then(setAllowedActions)
      .catch(() => {
        setAllowedActions([]);
      });
  }, [canAccessWorkspace, selectedServerId, selectedChannelId]);

  useEffect(() => {
    if (!canAccessWorkspace || !selectedServerId) {
      setLastReadByChannel({});
      return;
    }

    void listChannelReadStates(selectedServerId)
      .then((items) => {
        const next: Record<string, string> = {};
        for (const item of items) {
          next[item.channelId] = item.lastReadAt;
        }
        setLastReadByChannel(next);
      })
      .catch(() => {
        // Keep local map if read-state fetch fails.
      });
  }, [canAccessWorkspace, selectedServerId]);

  useEffect(() => {
    if (!canAccessWorkspace || !selectedServerId) {
      setReports([]);
      setAuditLogs([]);
      return;
    }

    void Promise.all([
      listReports(selectedServerId).catch(() => []),
      listAuditLogs(selectedServerId).catch(() => [])
    ]).then(([reportItems, auditItems]) => {
      setReports(reportItems);
      setAuditLogs(auditItems);
    });
  }, [canAccessWorkspace, selectedServerId]);

  useEffect(() => {
    if (!canAccessWorkspace || !selectedChannelId) {
      setMentions([]);
      return;
    }

    void listMentions(selectedChannelId, 150)
      .then((items) => {
        setMentions(items);
        setMentionCountByChannel((current) => ({
          ...current,
          [selectedChannelId]: items.length
        }));
      })
      .catch(() => {
        // Keep previous mention snapshot on fetch failures.
      });
  }, [canAccessWorkspace, selectedChannelId]);

  useEffect(() => {
    setPendingNewMessageCount(0);
    setLastSeenMessageId(null);
    setIsNearBottom(true);
    setVoiceConnected(false);
    setVoiceMuted(false);
    setVoiceDeafened(false);
    setVoiceGrant(null);
    setVoiceMembers([]);
  }, [selectedChannelId]);

  useEffect(() => {
    const selectedServer = servers.find((server) => server.id === selectedServerId);
    setRenameSpaceId(selectedServer?.id ?? "");
    setRenameSpaceName(selectedServer?.name ?? "");
    setDeleteTargetSpaceId((current) => current || selectedServer?.id || servers[0]?.id || "");
  }, [selectedServerId, servers]);

  useEffect(() => {
    const selected = channels.find((channel) => channel.id === selectedChannelId);
    setRenameRoomId(selected?.id ?? "");
    setRenameRoomName(selected?.name ?? "");
    setSelectedCategoryIdForCreate(selected?.categoryId ?? "");
  }, [channels, selectedChannelId]);

  useEffect(() => {
    if (categories.length === 0) {
      setRenameCategoryId("");
      setRenameCategoryName("");
      setSelectedCategoryIdForCreate("");
      return;
    }

    const current = categories.find((category) => category.id === renameCategoryId);
    const selected = current ?? categories[0]!;
    setRenameCategoryId(selected.id);
    setRenameCategoryName(selected.name);
    setSelectedCategoryIdForCreate((prev) => (prev === "" ? selected.id : prev));
  }, [categories, renameCategoryId]);

  useEffect(() => {
    if (!selectedChannelId) {
      return;
    }

    const newest = messages[messages.length - 1];
    if (!newest) {
      return;
    }

    setLastReadByChannel((current) => ({
      ...current,
      [selectedChannelId]: newest.createdAt
    }));

    void upsertChannelReadState(selectedChannelId, newest.createdAt).catch(() => {
      // Ignore transient read-state sync errors.
    });
  }, [messages, selectedChannelId]);

  useEffect(() => {
    if (!voiceConnected || !selectedServerId || !selectedChannelId || activeChannel?.type !== "voice") {
      setVoiceMembers([]);
      return;
    }

    let stopped = false;
    const refresh = () => {
      void listVoicePresence({
        serverId: selectedServerId,
        channelId: selectedChannelId
      })
        .then((items) => {
          if (stopped) {
            return;
          }
          setVoiceMembers(items);
        })
        .catch(() => {
          // Keep previous roster on transient failures.
        });
    };

    refresh();
    const timer = setInterval(refresh, 3000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [voiceConnected, selectedServerId, selectedChannelId, activeChannel?.type]);

  useEffect(() => {
    const newest = messages[messages.length - 1];
    if (!newest || newest.id === lastSeenMessageId) {
      return;
    }

    const list = messagesRef.current;
    if (!list) {
      return;
    }

    if (isNearBottom) {
      list.scrollTop = list.scrollHeight;
      setPendingNewMessageCount(0);
      setLastSeenMessageId(newest.id);
      return;
    }

    setPendingNewMessageCount((current) => current + 1);
    setLastSeenMessageId(newest.id);
  }, [isNearBottom, lastSeenMessageId, messages]);

  useEffect(() => {
    if (!canAccessWorkspace || !selectedChannelId) {
      setRealtimeState("disconnected");
      return;
    }

    let closed = false;
    let pollInterval: ReturnType<typeof setInterval> | null = null;

    const startPolling = () => {
      if (pollInterval) {
        return;
      }

      setRealtimeState("polling");
      pollInterval = setInterval(() => {
        void listMessages(selectedChannelId)
          .then((next) => setMessages(next.map((message) => ({ ...message }))))
          .catch(() => {
            // Keep previous messages on transient polling failures.
          });
      }, 3000);
    };

    const stopPolling = () => {
      if (!pollInterval) {
        return;
      }
      clearInterval(pollInterval);
      pollInterval = null;
    };

    startPolling();

    const disconnectStream = connectMessageStream(selectedChannelId, {
      onOpen: () => {
        if (closed) {
          return;
        }
        stopPolling();
        setRealtimeState("live");
      },
      onError: () => {
        if (closed) {
          return;
        }
        startPolling();
      },
      onMessageCreated: (message) => {
        setMessages((current) => {
          if (current.some((item) => item.id === message.id)) {
            return current;
          }
          return [...current, message];
        });
      }
    });

    return () => {
      closed = true;
      disconnectStream();
      stopPolling();
    };
  }, [canAccessWorkspace, selectedChannelId]);


  function getAdjacentId(currentId: string, ids: string[], direction: "next" | "previous"): string | null {
    if (ids.length === 0) {
      return null;
    }
    const currentIndex = ids.indexOf(currentId);
    if (currentIndex === -1) {
      return ids[0] ?? null;
    }

    const offset = direction === "next" ? 1 : -1;
    const nextIndex = (currentIndex + offset + ids.length) % ids.length;
    return ids[nextIndex] ?? null;
  }

  function handleServerKeyboardNavigation(event: ReactKeyboardEvent, currentServerId: string): void {
    const serverIds = servers.map((server) => server.id);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      const nextId = getAdjacentId(currentServerId, serverIds, "next");
      if (nextId) {
        void handleServerChange(nextId);
      }
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      const previousId = getAdjacentId(currentServerId, serverIds, "previous");
      if (previousId) {
        void handleServerChange(previousId);
      }
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      const first = serverIds[0];
      if (first) {
        void handleServerChange(first);
      }
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      const last = serverIds[serverIds.length - 1];
      if (last) {
        void handleServerChange(last);
      }
    }
  }

  function handleChannelKeyboardNavigation(event: ReactKeyboardEvent, currentChannelId: string): void {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      const nextId = getAdjacentId(currentChannelId, groupedChannelIds, "next");
      if (nextId) {
        void handleChannelChange(nextId);
      }
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      const previousId = getAdjacentId(currentChannelId, groupedChannelIds, "previous");
      if (previousId) {
        void handleChannelChange(previousId);
      }
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      const first = groupedChannelIds[0];
      if (first) {
        void handleChannelChange(first);
      }
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      const last = groupedChannelIds[groupedChannelIds.length - 1];
      if (last) {
        void handleChannelChange(last);
      }
    }
  }

  async function handleServerChange(serverId: string): Promise<void> {
    setSelectedServerId(serverId);
    setSelectedChannelId(null);
    setChannels([]);
    setCategories([]);
    setMessages([]);
    setError(null);
    try {
      await refreshChatState(serverId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to load channels.");
    }
  }

  async function handleChannelChange(channelId: string): Promise<void> {
    setSelectedChannelId(channelId);
    setError(null);
    try {
      const next = await listMessages(channelId);
      setMessages(next.map((message) => ({ ...message })));
      setUrlSelection(selectedServerId, channelId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to load messages.");
    }
  }

  function handleMessageListScroll(): void {
    const list = messagesRef.current;
    if (!list) {
      return;
    }

    const distanceFromBottom = list.scrollHeight - list.scrollTop - list.clientHeight;
    const nearBottom = distanceFromBottom < 24;
    setIsNearBottom(nearBottom);
    if (nearBottom) {
      setPendingNewMessageCount(0);
    }
  }

  function jumpToLatest(): void {
    const list = messagesRef.current;
    if (!list) {
      return;
    }

    list.scrollTop = list.scrollHeight;
    setIsNearBottom(true);
    setPendingNewMessageCount(0);
  }

  async function handleSetLock(lock: boolean): Promise<void> {
    if (!activeChannel || !selectedServerId) {
      return;
    }

    setUpdatingControls(true);
    setError(null);
    try {
      await updateChannelControls({
        channelId: activeChannel.id,
        serverId: selectedServerId,
        lock,
        reason: controlsReason
      });
      await refreshChatState(selectedServerId, activeChannel.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to update lock state.");
    } finally {
      setUpdatingControls(false);
    }
  }

  async function handleCreateSpace(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!selectedHubIdForCreate || !spaceName.trim()) {
      return;
    }

    setCreatingSpace(true);
    setError(null);
    try {
      const created = await createServer({
        hubId: selectedHubIdForCreate,
        name: spaceName.trim()
      });
      setSpaceName("New Space");
      await refreshChatState(created.id);
      setUrlSelection(created.id, null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to create space.");
    } finally {
      setCreatingSpace(false);
    }
  }

  async function handleCreateRoom(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!selectedServerId || !roomName.trim()) {
      return;
    }

    setCreatingRoom(true);
    setError(null);
    try {
      const created = await createChannel({
        serverId: selectedServerId,
        name: roomName.trim(),
        type: roomType,
        categoryId: selectedCategoryIdForCreate || undefined
      });
      setRoomName("new-room");
      await refreshChatState(selectedServerId, created.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to create room.");
    } finally {
      setCreatingRoom(false);
    }
  }

  async function handleCreateCategory(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!selectedServerId || !categoryName.trim()) {
      return;
    }

    setCreatingCategory(true);
    setError(null);
    try {
      await createCategory({
        serverId: selectedServerId,
        name: categoryName.trim()
      });
      setCategoryName("New Category");
      await refreshChatState(selectedServerId, selectedChannelId ?? undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to create category.");
    } finally {
      setCreatingCategory(false);
    }
  }

  async function handleRenameCategory(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!selectedServerId || !renameCategoryId || !renameCategoryName.trim()) {
      return;
    }

    setMutatingStructure(true);
    setError(null);
    try {
      await renameCategory({
        categoryId: renameCategoryId,
        serverId: selectedServerId,
        name: renameCategoryName.trim()
      });
      await refreshChatState(selectedServerId, selectedChannelId ?? undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to rename category.");
    } finally {
      setMutatingStructure(false);
    }
  }

  async function moveCategoryPosition(categoryId: string, direction: "up" | "down"): Promise<void> {
    if (!selectedServerId) return;
    const index = categories.findIndex(c => c.id === categoryId);
    if (index === -1) return;

    const targetIndex = direction === "up" ? index - 1 : index + 1;
    const neighbor = categories[targetIndex];
    if (!neighbor) return;

    const current = categories[index];
    if (!current) return;

    setMutatingStructure(true);
    try {
      // Swap positions
      await Promise.all([
        renameCategory({ categoryId: current.id, serverId: selectedServerId, position: neighbor.position }),
        renameCategory({ categoryId: neighbor.id, serverId: selectedServerId, position: current.position })
      ]);
      await refreshChatState(selectedServerId, selectedChannelId ?? undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to reorder category.");
    } finally {
      setMutatingStructure(false);
    }
  }

  async function handleMoveSelectedRoomCategory(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!selectedServerId || !selectedChannelId) {
      return;
    }

    setMutatingStructure(true);
    setError(null);
    try {
      await moveChannelCategory({
        channelId: selectedChannelId,
        serverId: selectedServerId,
        categoryId: selectedCategoryIdForCreate || null
      });
      await refreshChatState(selectedServerId, selectedChannelId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to move room.");
    } finally {
      setMutatingStructure(false);
    }
  }

  async function handleDeleteCategory(categoryId: string): Promise<void> {
    if (!selectedServerId) {
      return;
    }

    setMutatingStructure(true);
    setError(null);
    try {
      await deleteCategory({
        serverId: selectedServerId,
        categoryId: categoryId
      });
      await refreshChatState(selectedServerId, selectedChannelId ?? undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to delete category.");
    } finally {
      setMutatingStructure(false);
    }
  }

  async function handleRenameSpace(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!renameSpaceId || !renameSpaceName.trim()) {
      return;
    }

    setMutatingStructure(true);
    setError(null);
    try {
      await renameServer({
        serverId: renameSpaceId,
        name: renameSpaceName.trim()
      });
      setRenameSpaceName("");
      await refreshChatState(renameSpaceId, selectedChannelId ?? undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to rename space.");
    } finally {
      setMutatingStructure(false);
    }
  }

  async function handleDeleteSpace(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const targetServerId = deleteTargetSpaceId || renameSpaceId || selectedServerId;
    if (!targetServerId) return;
    if (deleteSpaceConfirm.trim() !== "DELETE SPACE") {
      setError("Type DELETE SPACE to confirm.");
      return;
    }
    await performDeleteSpace(targetServerId);
  }

  async function performDeleteSpace(serverId: string): Promise<void> {
    setMutatingStructure(true);
    setError(null);
    try {
      await deleteServer(serverId);
      setDeleteSpaceConfirm("");
      const remainingServers = servers.filter((s) => s.id !== serverId);
      await refreshChatState(remainingServers[0]?.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to delete space.");
    } finally {
      setMutatingStructure(false);
    }
  }

  async function handleRenameRoom(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!renameRoomId || !renameRoomName.trim() || !selectedServerId) {
      return;
    }

    setMutatingStructure(true);
    setError(null);
    try {
      await renameChannel({
        channelId: renameRoomId,
        serverId: selectedServerId,
        name: renameRoomName.trim(),
        type: renameRoomType,
        categoryId: renameRoomCategoryId
      });
      setRenameRoomName("");
      await refreshChatState(selectedServerId, renameRoomId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to update room.");
    } finally {
      setMutatingStructure(false);
    }
  }

  async function moveChannelPosition(channelId: string, direction: "up" | "down"): Promise<void> {
    if (!selectedServerId) return;
    const channel = channels.find(c => c.id === channelId);
    if (!channel) return;

    // Reordering happens WITHIN the same category (or within Uncategorized)
    const peers = channels
      .filter(c => c.categoryId === channel.categoryId)
      .sort((a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt));

    const index = peers.findIndex(c => c.id === channelId);
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    const neighbor = peers[targetIndex];
    if (!neighbor) return;

    setMutatingStructure(true);
    try {
      await Promise.all([
        renameChannel({ channelId: channel.id, serverId: selectedServerId, position: neighbor.position }),
        renameChannel({ channelId: neighbor.id, serverId: selectedServerId, position: channel.position })
      ]);
      await refreshChatState(selectedServerId, channelId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to reorder room.");
    } finally {
      setMutatingStructure(false);
    }
  }

  async function handleDeleteRoom(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!selectedChannelId || !selectedServerId) return;
    if (deleteRoomConfirm.trim() !== "DELETE ROOM") {
      setError("Type DELETE ROOM to confirm.");
      return;
    }
    await performDeleteRoom(selectedServerId, selectedChannelId);
  }

  async function performDeleteRoom(serverId: string, channelId: string): Promise<void> {
    setMutatingStructure(true);
    setError(null);
    try {
      await deleteChannel({ serverId, channelId });
      setDeleteRoomConfirm("");
      const remainingChannels = channels.filter((c) => c.id !== channelId);
      await refreshChatState(serverId, remainingChannels[0]?.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to delete room.");
    } finally {
      setMutatingStructure(false);
    }
  }

  async function handleUpdateSlowMode(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!activeChannel || !selectedServerId) {
      return;
    }

    const parsed = Number(slowModeSeconds);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 600) {
      setError("Slow mode must be between 0 and 600 seconds.");
      return;
    }

    setUpdatingControls(true);
    setError(null);
    try {
      await updateChannelControls({
        channelId: activeChannel.id,
        serverId: selectedServerId,
        slowModeSeconds: Math.floor(parsed),
        reason: controlsReason
      });
      await refreshChatState(selectedServerId, activeChannel.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to update slow mode.");
    } finally {
      setUpdatingControls(false);
    }
  }

  async function handleModerationAction(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!selectedServerId) {
      return;
    }

    setError(null);
    try {
      await performModerationAction({
        action: modActionType,
        serverId: selectedServerId,
        channelId: selectedChannelId ?? undefined,
        targetUserId: modTargetUserId || undefined,
        reason: modReason
      });
      const [reportItems, auditItems] = await Promise.all([
        listReports(selectedServerId).catch(() => []),
        listAuditLogs(selectedServerId).catch(() => [])
      ]);
      setReports(reportItems);
      setAuditLogs(auditItems);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to run moderation action.");
    }
  }

  async function handleCreateReport(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!selectedServerId || !reportReason.trim()) {
      return;
    }

    setError(null);
    try {
      await createReport({
        serverId: selectedServerId,
        channelId: selectedChannelId ?? undefined,
        targetUserId: reportTargetUserId || undefined,
        reason: reportReason.trim()
      });
      setReportReason("Report reason");
      setReportTargetUserId("");
      setReports(await listReports(selectedServerId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to create report.");
    }
  }

  async function handleTransitionReport(reportId: string, status: "triaged" | "resolved" | "dismissed"): Promise<void> {
    if (!selectedServerId) {
      return;
    }
    setError(null);
    try {
      await transitionReportStatus({
        reportId,
        serverId: selectedServerId,
        status,
        reason: `Report ${status}`
      });
      setReports(await listReports(selectedServerId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to transition report.");
    }
  }

  async function handleJoinVoice(): Promise<void> {
    if (!selectedServerId || !selectedChannelId || activeChannel?.type !== "voice") {
      return;
    }

    setError(null);
    try {
      const grant = await issueVoiceTokenWithVideo({
        serverId: selectedServerId,
        channelId: selectedChannelId,
        videoQuality: voiceVideoQuality
      });
      await joinVoicePresence({
        serverId: selectedServerId,
        channelId: selectedChannelId,
        muted: voiceMuted,
        deafened: voiceDeafened,
        videoEnabled: voiceVideoEnabled,
        videoQuality: voiceVideoQuality
      });
      setVoiceGrant(grant);
      setVoiceConnected(true);
      setVoiceMembers(
        await listVoicePresence({
          serverId: selectedServerId,
          channelId: selectedChannelId
        })
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to join voice.");
    }
  }

  async function handleLeaveVoice(): Promise<void> {
    if (!selectedServerId || !selectedChannelId || !voiceConnected) {
      return;
    }

    setError(null);
    try {
      await leaveVoicePresence({
        serverId: selectedServerId,
        channelId: selectedChannelId
      });
      setVoiceConnected(false);
      setVoiceGrant(null);
      setVoiceMembers([]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to leave voice.");
    }
  }

  async function handleToggleMuteDeafen(nextMuted: boolean, nextDeafened: boolean): Promise<void> {
    if (!selectedServerId || !selectedChannelId || !voiceConnected) {
      setVoiceMuted(nextMuted);
      setVoiceDeafened(nextDeafened);
      return;
    }

    setError(null);
    try {
      await updateVoicePresenceState({
        serverId: selectedServerId,
        channelId: selectedChannelId,
        muted: nextMuted,
        deafened: nextDeafened,
        videoEnabled: voiceVideoEnabled,
        videoQuality: voiceVideoQuality
      });
      setVoiceMuted(nextMuted);
      setVoiceDeafened(nextDeafened);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to update voice state.");
    }
  }

  async function handleToggleVideo(nextVideoEnabled: boolean): Promise<void> {
    setVoiceVideoEnabled(nextVideoEnabled);
    if (!selectedServerId || !selectedChannelId || !voiceConnected) {
      return;
    }
    setError(null);
    try {
      await updateVoicePresenceState({
        serverId: selectedServerId,
        channelId: selectedChannelId,
        muted: voiceMuted,
        deafened: voiceDeafened,
        videoEnabled: nextVideoEnabled,
        videoQuality: voiceVideoQuality
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to update video state.");
    }
  }

  async function handleSetVoiceChannelVideoDefaults(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!selectedServerId || !selectedChannelId || activeChannel?.type !== "voice") {
      return;
    }
    setError(null);
    try {
      await updateChannelVideoControls({
        channelId: selectedChannelId,
        serverId: selectedServerId,
        videoEnabled: voiceVideoEnabled,
        maxVideoParticipants: 4
      });
      await refreshChatState(selectedServerId, selectedChannelId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to update voice defaults.");
    }
  }

  async function handleBootstrap(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setBootstrapping(true);
    setError(null);
    try {
      const result = await bootstrapAdmin({ setupToken, hubName });
      setSetupToken("");
      await refreshAuthState();
      await refreshChatState(result.defaultServerId, result.defaultChannelId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Bootstrap failed.");
    } finally {
      setBootstrapping(false);
    }
  }

  async function handleOnboardingUsername(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!onboardingUsername.trim()) {
      return;
    }

    setSavingOnboarding(true);
    setError(null);
    try {
      await completeUsernameOnboarding(onboardingUsername.trim());
      setOnboardingUsername("");
      await refreshAuthState();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to save username.");
    } finally {
      setSavingOnboarding(false);
    }
  }

  async function sendContentWithOptimistic(content: string, existingMessageId?: string): Promise<void> {
    if (!selectedChannelId || !viewer || !content.trim()) {
      return;
    }

    const tempId = existingMessageId ?? `tmp_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const optimisticMessage: MessageItem = {
      id: tempId,
      channelId: selectedChannelId,
      authorUserId: viewer.productUserId,
      authorDisplayName: viewer.identity?.preferredUsername ?? "You",
      content,
      createdAt: new Date().toISOString(),
      clientState: "sending"
    };

    setMessages((current) => {
      if (existingMessageId) {
        return current.map((item) => (item.id === existingMessageId ? optimisticMessage : item));
      }
      return [...current, optimisticMessage];
    });

    setSending(true);
    setError(null);
    try {
      const persisted = await sendMessage(selectedChannelId, content.trim());
      setMessages((current) => current.map((item) => (item.id === tempId ? persisted : item)));
    } catch (cause) {
      setMessages((current) =>
        current.map((item) =>
          item.id === tempId
            ? {
              ...item,
              clientState: "failed"
            }
            : item
        )
      );
      setError(cause instanceof Error ? cause.message : "Message send failed.");
    } finally {
      setSending(false);
    }
  }

  async function submitDraftMessage(): Promise<void> {
    if (!selectedChannelId || !draftMessage.trim()) {
      return;
    }

    const content = draftMessage.trim();
    setDraftMessage("");
    await sendContentWithOptimistic(content);
    messageInputRef.current?.focus();
  }

  async function handleSendMessage(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    await submitDraftMessage();
  }

  async function handleLogout(): Promise<void> {
    setError(null);
    try {
      await logout();
      setViewer(null);
      setServers([]);
      setChannels([]);
      setMessages([]);
      await initialize();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Logout failed.");
    }
  }

  if (loading) {
    return (
      <main className="app">
        <section className="panel">
          <h1>EscapeHatch</h1>
          <p>Loading local workspace...</p>
        </section>
      </main>
    );
  }

  return (
    <main className="app">
      <header className="topbar">
        <h1>EscapeHatch Local Chat</h1>
        <div className="topbar-meta">
          <button
            type="button"
            className="icon-button"
            title={theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"}
            onClick={toggleTheme}
          >
            {theme === "light" ? "🌙" : "☀️"}
          </button>
          {canManageCurrentSpace ? (
            <Link href="/admin" className="ghost">
              Admin Console
            </Link>
          ) : null}
          <Link href="/settings" className="icon-button" title="User Settings">
            ⚙️
          </Link>
          <span className="status-pill" data-state={realtimeState}>
            {realtimeState === "live" ? "Live" : realtimeState === "polling" ? "Polling" : "Offline"}
          </span>
          <span aria-live="polite">
            Signed in as {viewer?.identity?.preferredUsername ?? "Guest"}
          </span>
          {viewer ? (
            <button type="button" className="ghost" onClick={handleLogout}>
              Sign out
            </button>
          ) : null}
        </div>
      </header>

      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}

      {!viewer ? (
        <div className="login-container">
          <div className="login-card">
            <h2>EscapeHatch</h2>
            <p>Log in to access your workspace</p>
            <div className="stack">
              {enabledLoginProviders.length > 0 ? (
                enabledLoginProviders.map((provider) => {
                  let btnClass = "provider-button";
                  if (provider.provider === "discord") btnClass += " discord";
                  if (provider.provider === "twitch") btnClass += " twitch";
                  if (provider.provider === "google") btnClass += " google";
                  if (provider.provider === "dev") btnClass += " dev";

                  if (provider.provider === "dev") {
                    return (
                      <form
                        key={provider.provider}
                        onSubmit={(event) => {
                          event.preventDefault();
                          window.location.href = providerLoginUrl("dev", devUsername);
                        }}
                        className="stack"
                        style={{ marginTop: "1rem", borderTop: "1px solid var(--border)", paddingTop: "1rem" }}
                      >
                        <p style={{ fontSize: "0.9rem", margin: "0 0 0.5rem" }}>Or use developer login:</p>
                        <input
                          id="dev-username"
                          value={devUsername}
                          onChange={(event) => setDevUsername(event.target.value)}
                          minLength={3}
                          maxLength={40}
                          placeholder="Dev Username"
                          required
                        />
                        <button type="submit" className={btnClass}>
                          Dev Login
                        </button>
                      </form>
                    );
                  }

                  return (
                    <a key={provider.provider} className={btnClass} href={providerLoginUrl(provider.provider)}>
                      {provider.provider === "discord" && (
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037 13.48 13.48 0 0 0-.59 1.227 18.3 18.3 0 0 0-5.526 0 13.483 13.483 0 0 0-.59-1.227.073.073 0 0 0-.079-.037 19.792 19.792 0 0 0-4.885 1.515.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                        </svg>
                      )}
                      {provider.provider === "twitch" && (
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h2.998L24 9.428V0H6zM2.571 4.286h18.857v5.143L21.428 9.43v10.286H11.999l-3 3v-3H6.857V4.286H2.57z" />
                        </svg>
                      )}
                      Continue with {provider.displayName}
                    </a>
                  );
                })
              ) : (
                <p>No OAuth providers are enabled.</p>
              )}
            </div>
            {!providers?.providers.some((provider) => provider.isEnabled) ? (
              <p style={{ marginTop: "1rem", fontSize: "0.8rem", color: "var(--danger)" }}>
                Configure providers in .env
              </p>
            ) : null}
          </div>
        </div>
      ) : null}


      {viewer && viewer.needsOnboarding ? (
        <section className="panel">
          <h2>Choose Username</h2>
          <p>Complete onboarding by picking your handle. This is used for mentions and display.</p>
          <form onSubmit={handleOnboardingUsername} className="stack">
            <label htmlFor="onboarding-username">Username</label>
            <input
              id="onboarding-username"
              value={onboardingUsername}
              onChange={(event) => setOnboardingUsername(event.target.value)}
              minLength={3}
              maxLength={40}
              pattern="^[a-zA-Z0-9._-]+$"
              required
            />
            <button type="submit" disabled={savingOnboarding}>
              {savingOnboarding ? "Saving..." : "Save Username"}
            </button>
          </form>
        </section>
      ) : null}

      {viewer && !viewer.needsOnboarding && !bootstrapStatus?.initialized ? (
        <section className="panel">
          <h2>Initialize Workspace</h2>
          <p>First login must bootstrap the hub and default channel.</p>
          <form onSubmit={handleBootstrap} className="stack">
            <label htmlFor="hub-name">Hub Name</label>
            <input
              id="hub-name"
              value={hubName}
              onChange={(event) => setHubName(event.target.value)}
              minLength={2}
              maxLength={80}
              required
            />
            <label htmlFor="setup-token">Setup Token</label>
            <input
              id="setup-token"
              value={setupToken}
              onChange={(event) => setSetupToken(event.target.value)}
              minLength={1}
              required
            />
            <button type="submit" disabled={bootstrapping}>
              {bootstrapping ? "Bootstrapping..." : "Bootstrap Admin + Hub"}
            </button>
          </form>
        </section>
      ) : null}

      {viewer && !viewer.needsOnboarding && bootstrapStatus?.initialized ? (
        <section className={isDetailsOpen ? "chat-shell" : "chat-shell details-collapsed"} aria-label="Chat workspace">
          <nav className="servers panel" aria-label="Servers">
            <div className="category-header">
              <h2>Servers</h2>
              {canManageHub && (
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Create Space"
                  onClick={() => setActiveModal("create-space")}
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
                      }}
                      onKeyDown={(event) => {
                        handleServerKeyboardNavigation(event, server.id);
                      }}
                    >
                      {server.name}
                      {canManageCurrentSpace && selectedServerId === server.id && (
                        <div className="inline-mgmt persistent">
                          <button
                            type="button"
                            className="icon-button"
                            title="Edit Server"
                            onClick={(e) => {
                              e.stopPropagation();
                              setRenameSpaceId(server.id);
                              setRenameSpaceName(server.name);
                              setActiveModal("rename-space");
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
                                setDeleteSpaceConfirm("DELETE SPACE");
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
              {canManageCurrentSpace && (
                <Link href="/admin" className="ghost button-link" style={{ width: '100%' }}>
                  Admin Console
                </Link>
              )}
            </div>
          </nav>

          <nav className="channels panel" aria-label="Channels">
            <div className="category-header" style={{ position: 'relative' }}>
              <h2>Channels</h2>
              {canManageCurrentSpace && (
                <>
                  <button
                    type="button"
                    className="icon-button"
                    title="Add..."
                    onClick={() => setIsAddMenuOpen((prev) => !prev)}
                  >
                    +
                  </button>
                  {isAddMenuOpen && (
                    <div className="add-menu-dropdown">
                      <button type="button" onClick={() => {
                        setSelectedCategoryIdForCreate("");
                        setActiveModal("create-room");
                        setIsAddMenuOpen(false);
                      }}>
                        New Room
                      </button>
                      <button type="button" onClick={() => {
                        setActiveModal("create-category");
                        setIsAddMenuOpen(false);
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
              value={channelFilter}
              onChange={(event) => setChannelFilter(event.target.value)}
              style={{ marginBottom: '0.5rem', width: '100%' }}
            />

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
                              setSelectedCategoryIdForCreate(group.id ?? "");
                              setActiveModal("create-room");
                            }}
                          >
                            +
                          </button>
                          <button
                            type="button"
                            className="icon-button"
                            title="Rename Category"
                            onClick={() => {
                              setRenameCategoryId(group.id!);
                              setRenameCategoryName(group.name);
                              setActiveModal("rename-category");
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
                                    setRenameRoomId(channel.id);
                                    setRenameRoomName(channel.name);
                                    setRenameRoomType(channel.type);
                                    setRenameRoomCategoryId(channel.categoryId);
                                    setActiveModal("rename-room");
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
                                      setDeleteRoomConfirm("DELETE ROOM");
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
          </nav>

          <section className="timeline panel" aria-label="Messages">
            <header className="channel-header">
              <div>
                <h2>{activeChannel ? `#${activeChannel.name}` : "No channel selected"}</h2>
                <p>
                  {activeChannel
                    ? `${messages.length} messages · slow mode ${activeChannel.slowModeSeconds}s`
                    : "Select a channel to start chatting"}
                </p>
              </div>
              <div className="channel-actions">
                <span className="channel-badge">{activeChannel?.type ?? "none"}</span>
                {canManageChannel && activeChannel ? (
                  <button type="button" className="ghost" onClick={() => setControlsOpen((current) => !current)}>
                    {controlsOpen ? "Close Controls" : "Channel Controls"}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="ghost"
                  title={isDetailsOpen ? "Hide Details" : "Show Details"}
                  onClick={() => setIsDetailsOpen((prev) => !prev)}
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

          {isDetailsOpen && (
            <aside className="context panel" aria-label="Channel context">
              <h2>Channel Details</h2>
              {activeChannel ? (
                <>
                  <p className="context-line">
                    <strong>Name:</strong> #{activeChannel.name}
                  </p>
                  <p className="context-line">
                    <strong>Type:</strong> {activeChannel.type}
                  </p>
                  <p className="context-line">
                    <strong>Locked:</strong> {activeChannel.isLocked ? "Yes" : "No"}
                  </p>
                  <p className="context-line">
                    <strong>Slow mode:</strong> {activeChannel.slowModeSeconds}s
                  </p>
                  {(mentions.length ?? 0) > 0 ? (
                    <p className="context-line">
                      <strong>Mentions in channel:</strong> {mentions.length}
                    </p>
                  ) : null}
                  {activeChannel.type === "voice" ? (
                    <>
                      <hr />
                      <h3>Voice Controls</h3>
                      <p className="context-line">
                        <strong>Status:</strong> {voiceConnected ? "Connected" : "Disconnected"}
                      </p>
                      {voiceGrant ? (
                        <p className="context-line">
                          <strong>Voice Room:</strong> {voiceGrant.sfuRoomId}
                        </p>
                      ) : null}
                      <div className="voice-actions">
                        {!voiceConnected ? (
                          <button
                            type="button"
                            onClick={() => {
                              void handleJoinVoice();
                            }}
                          >
                            Join Voice
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="ghost"
                            onClick={() => {
                              void handleLeaveVoice();
                            }}
                          >
                            Leave Voice
                          </button>
                        )}
                        <button
                          type="button"
                          className={voiceMuted ? "ghost active-toggle" : "ghost"}
                          onClick={() => {
                            void handleToggleMuteDeafen(!voiceMuted, voiceDeafened);
                          }}
                        >
                          {voiceMuted ? "Unmute" : "Mute"}
                        </button>
                        <button
                          type="button"
                          className={voiceDeafened ? "ghost active-toggle" : "ghost"}
                          onClick={() => {
                            void handleToggleMuteDeafen(voiceMuted, !voiceDeafened);
                          }}
                        >
                          {voiceDeafened ? "Undeafen" : "Deafen"}
                        </button>
                        <button
                          type="button"
                          className={voiceVideoEnabled ? "ghost active-toggle" : "ghost"}
                          onClick={() => {
                            void handleToggleVideo(!voiceVideoEnabled);
                          }}
                        >
                          {voiceVideoEnabled ? "Disable Video" : "Enable Video"}
                        </button>
                      </div>
                      <label htmlFor="voice-video-quality">Video Quality</label>
                      <select
                        id="voice-video-quality"
                        value={voiceVideoQuality}
                        onChange={(event) => setVoiceVideoQuality(event.target.value as "low" | "medium" | "high")}
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                      {canManageChannel ? (
                        <form className="stack" onSubmit={handleSetVoiceChannelVideoDefaults}>
                          <button type="submit">Save Voice Channel Video Defaults</button>
                        </form>
                      ) : null}
                      <h3>Voice Roster</h3>
                      <ul className="member-list">
                        {voiceMembers.length === 0 ? <li>No one connected.</li> : null}
                        {voiceMembers.map((member) => (
                          <li key={member.userId}>
                            <span className="member-dot" />
                            {member.displayName}
                            {member.muted ? " (muted)" : ""}
                            {member.deafened ? " (deafened)" : ""}
                            {member.videoEnabled ? ` (video:${member.videoQuality})` : ""}
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : null}
                  <hr />
                  <h3>Members in View</h3>
                  <ul className="member-list">
                    {memberRoster.length === 0 ? <li>No active members yet.</li> : null}
                    {memberRoster.map((member) => (
                      <li key={member.id}>
                        <span className="member-dot" />
                        {member.displayName}
                      </li>
                    ))}
                  </ul>
                  {canManageCurrentSpace ? (
                    <>
                      <hr />
                      <h3>Manager Console</h3>
                      <p className="context-line">Open the manager dialog from the account area.</p>
                    </>
                  ) : null}
                </>
              ) : (
                <p>Select a channel to see context.</p>
              )}
            </aside>
          )}
        </section>
      ) : null}

      {activeModal && (
        <div className="modal-backdrop" onClick={() => setActiveModal(null)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <header className="modal-header">
              <h2>
                {activeModal === "create-space" && "Create New Space"}
                {activeModal === "create-category" && "Create New Category"}
                {activeModal === "create-room" && "Create New Room"}
                {activeModal === "rename-space" && "Rename Space"}
                {activeModal === "rename-category" && "Rename Category"}
                {activeModal === "rename-room" && "Rename Room"}
              </h2>
              <button type="button" className="ghost" onClick={() => setActiveModal(null)}>×</button>
            </header>

            {activeModal === "create-space" && (
              <form className="stack" onSubmit={(e) => {
                void handleCreateSpace(e);
                setActiveModal(null);
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
                <button type="submit" disabled={creatingSpace}>Create Space</button>
              </form>
            )}

            {activeModal === "rename-space" && (
              <form className="stack" onSubmit={(e) => {
                void handleRenameSpace(e);
                setActiveModal(null);
              }}>
                <label htmlFor="rename-space-modal">New Space Name</label>
                <input
                  id="rename-space-modal"
                  autoFocus
                  value={renameSpaceName}
                  onChange={(e) => setRenameSpaceName(e.target.value)}
                  minLength={2}
                  maxLength={80}
                  required
                />
                <button type="submit" disabled={mutatingStructure}>Save Changes</button>
              </form>
            )}

            {activeModal === "create-category" && (
              <form className="stack" onSubmit={(e) => {
                void handleCreateCategory(e);
                setActiveModal(null);
              }}>
                <label htmlFor="category-name-modal">Category Name</label>
                <input
                  id="category-name-modal"
                  autoFocus
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  minLength={2}
                  maxLength={80}
                  required
                />
                <button type="submit" disabled={creatingCategory}>Create Category</button>
              </form>
            )}

            {activeModal === "rename-category" && (
              <div className="stack">
                <form className="stack" onSubmit={(e) => {
                  void handleRenameCategory(e);
                  setActiveModal(null);
                }}>
                  <p>Editing category: <strong>{categories.find(c => c.id === renameCategoryId)?.name}</strong></p>
                  <label htmlFor="rename-category-modal">Category Name</label>
                  <input
                    id="rename-category-modal"
                    autoFocus
                    value={renameCategoryName}
                    onChange={(e) => setRenameCategoryName(e.target.value)}
                    minLength={2}
                    maxLength={80}
                    required
                  />
                  <button type="submit" disabled={mutatingStructure}>Save Name</button>
                </form>

                <div className="stack" style={{ borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
                  <p>Reorder Category</p>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button
                      type="button"
                      disabled={mutatingStructure || categories.findIndex(c => c.id === renameCategoryId) === 0}
                      onClick={() => moveCategoryPosition(renameCategoryId, "up")}
                    >
                      Move Up
                    </button>
                    <button
                      type="button"
                      disabled={mutatingStructure || categories.findIndex(c => c.id === renameCategoryId) === categories.length - 1}
                      onClick={() => moveCategoryPosition(renameCategoryId, "down")}
                    >
                      Move Down
                    </button>
                  </div>
                </div>

                <div className="stack" style={{ borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
                  <p>Danger Zone</p>
                  <button
                    type="button"
                    className="danger"
                    disabled={mutatingStructure}
                    onClick={() => {
                      const cat = categories.find(c => c.id === renameCategoryId);
                      if (confirm(`Are you sure you want to delete the category "${cat?.name}"? Rooms inside will become uncategorized.`)) {
                        void handleDeleteCategory(renameCategoryId);
                        setActiveModal(null);
                      }
                    }}
                  >
                    Delete Category
                  </button>
                </div>
              </div>
            )}

            {activeModal === "create-room" && (
              <form className="stack" onSubmit={(e) => {
                void handleCreateRoom(e);
                setActiveModal(null);
              }}>
                <p>
                  Target Category: <strong>
                    {selectedCategoryIdForCreate ? categories.find(c => c.id === selectedCategoryIdForCreate)?.name : "Uncategorized"}
                  </strong>
                </p>
                <label htmlFor="room-name-modal">Room Name</label>
                <input
                  id="room-name-modal"
                  autoFocus
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  minLength={2}
                  maxLength={80}
                  required
                />
                <label htmlFor="room-type-modal">Type</label>
                <select id="room-type-modal" value={roomType} onChange={(e) => setRoomType(e.target.value as any)}>
                  <option value="text">Text Room</option>
                  <option value="announcement">Announcement Room</option>
                  <option value="voice">Voice Room</option>
                </select>
                <button type="submit" disabled={creatingRoom}>Create Room</button>
              </form>
            )}

            {activeModal === "rename-room" && (
              <div className="stack">
                <form className="stack" onSubmit={(e) => {
                  void handleRenameRoom(e);
                  setActiveModal(null);
                }}>
                  <p>Editing room: <strong>{channels.find(c => c.id === renameRoomId)?.name}</strong></p>
                  <label htmlFor="rename-room-modal">Room Name</label>
                  <input
                    id="rename-room-modal"
                    autoFocus
                    value={renameRoomName}
                    onChange={(e) => setRenameRoomName(e.target.value)}
                    minLength={2}
                    maxLength={80}
                    required
                  />

                  <label htmlFor="rename-room-type">Type</label>
                  <select
                    id="rename-room-type"
                    value={renameRoomType}
                    onChange={(e) => setRenameRoomType(e.target.value as any)}
                  >
                    <option value="text">Text Room</option>
                    <option value="announcement">Announcement Room</option>
                    <option value="voice">Voice Room</option>
                  </select>

                  <label htmlFor="rename-room-category">Category</label>
                  <select
                    id="rename-room-category"
                    value={renameRoomCategoryId ?? ""}
                    onChange={(e) => setRenameRoomCategoryId(e.target.value || null)}
                  >
                    <option value="">(None)</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>

                  <button type="submit" disabled={mutatingStructure}>Save Changes</button>
                </form>

                <div className="stack" style={{ borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
                  <p>Reorder Room</p>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button
                      type="button"
                      disabled={mutatingStructure || (() => {
                        const channel = channels.find(c => c.id === renameRoomId);
                        if (!channel) return true;
                        const peers = channels.filter(c => c.categoryId === channel.categoryId)
                          .sort((a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt));
                        return peers.findIndex(c => c.id === renameRoomId) === 0;
                      })()}
                      onClick={() => moveChannelPosition(renameRoomId, "up")}
                    >
                      Move Up
                    </button>
                    <button
                      type="button"
                      disabled={mutatingStructure || (() => {
                        const channel = channels.find(c => c.id === renameRoomId);
                        if (!channel) return true;
                        const peers = channels.filter(c => c.categoryId === channel.categoryId)
                          .sort((a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt));
                        return peers.findIndex(c => c.id === renameRoomId) === peers.length - 1;
                      })()}
                      onClick={() => moveChannelPosition(renameRoomId, "down")}
                    >
                      Move Down
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
