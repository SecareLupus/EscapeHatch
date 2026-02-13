"use client";

import { FormEvent, KeyboardEvent as ReactKeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Category, Channel, ChatMessage, Server } from "@escapehatch/shared";
import {
  bootstrapAdmin,
  connectMessageStream,
  createCategory,
  createChannel,
  createServer,
  deleteChannel,
  deleteServer,
  fetchAllowedActions,
  fetchAuthProviders,
  fetchBootstrapStatus,
  fetchViewerSession,
  listHubs,
  listCategories,
  listChannels,
  listMessages,
  listServers,
  listViewerRoleBindings,
  moveChannelCategory,
  logout,
  providerLoginUrl,
  renameCategory,
  renameChannel,
  renameServer,
  sendMessage,
  updateChannelControls,
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
  const [sending, setSending] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [realtimeState, setRealtimeState] = useState<"disconnected" | "polling" | "live">("disconnected");
  const [allowedActions, setAllowedActions] = useState<PrivilegedAction[]>([]);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [controlsReason, setControlsReason] = useState("Channel policy update");
  const [slowModeSeconds, setSlowModeSeconds] = useState("0");
  const [updatingControls, setUpdatingControls] = useState(false);
  const [lastReadByChannel, setLastReadByChannel] = useState<Record<string, string>>({});
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
  const [deleteSpaceConfirm, setDeleteSpaceConfirm] = useState("");
  const [deleteTargetSpaceId, setDeleteTargetSpaceId] = useState<string>("");
  const [deleteRoomConfirm, setDeleteRoomConfirm] = useState("");
  const [mutatingStructure, setMutatingStructure] = useState(false);
  const [managementDialogOpen, setManagementDialogOpen] = useState(false);
  const messagesRef = useRef<HTMLOListElement | null>(null);
  const chatStateRequestIdRef = useRef(0);
  const managementDialogRef = useRef<HTMLElement | null>(null);
  const initialChatLoadKeyRef = useRef<string | null>(null);

  const activeProvider = useMemo(() => providers?.primaryProvider ?? "discord", [providers]);
  const activeChannel = channels.find((channel) => channel.id === selectedChannelId) ?? null;
  const canManageChannel = useMemo(
    () =>
      allowedActions.includes("channel.lock") ||
      allowedActions.includes("channel.unlock") ||
      allowedActions.includes("channel.slowmode"),
    [allowedActions]
  );
  const canManageHubOrSpace = useMemo(
    () =>
      viewerRoles.some(
        (binding) => binding.role === "hub_operator" || binding.role === "creator_admin"
      ),
    [viewerRoles]
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
    if (uncategorized.length > 0) {
      groups.push({ id: null, name: "Uncategorized", channels: uncategorized });
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
    const [providerData, viewerData, bootstrapData, roleBindings, hubItems] = await Promise.all([
      fetchAuthProviders(),
      fetchViewerSession(),
      fetchBootstrapStatus(),
      listViewerRoleBindings().catch(() => []),
      listHubs().catch(() => [])
    ]);

    setProviders(providerData);
    setViewer(viewerData);
    setBootstrapStatus(bootstrapData);
    setViewerRoles(roleBindings);
    setHubs(hubItems.map((hub) => ({ id: hub.id, name: hub.name })));
    setSelectedHubIdForCreate((current) => current ?? hubItems[0]?.id ?? null);
  }, []);

  const refreshChatState = useCallback(async (preferredServerId?: string, preferredChannelId?: string): Promise<void> => {
    const requestId = ++chatStateRequestIdRef.current;
    const serverItems = await listServers();
    if (requestId !== chatStateRequestIdRef.current) {
      return;
    }
    setServers(serverItems);

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

  useEffect(() => {
    if (!viewer || !bootstrapStatus?.initialized) {
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
    if (!viewer || !bootstrapStatus?.initialized || !selectedServerId) {
      setAllowedActions([]);
      return;
    }

    void fetchAllowedActions(selectedServerId, selectedChannelId ?? undefined)
      .then(setAllowedActions)
      .catch(() => {
        setAllowedActions([]);
      });
  }, [viewer, bootstrapStatus?.initialized, selectedServerId, selectedChannelId]);

  useEffect(() => {
    setPendingNewMessageCount(0);
    setLastSeenMessageId(null);
    setIsNearBottom(true);
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
  }, [messages, selectedChannelId]);

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
    if (!viewer || !bootstrapStatus?.initialized || !selectedChannelId) {
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
  }, [viewer, bootstrapStatus?.initialized, selectedChannelId]);

  useEffect(() => {
    if (!managementDialogOpen) {
      return;
    }

    const dialog = managementDialogRef.current;
    if (!dialog) {
      return;
    }

    const selectors =
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const getFocusableElements = (): HTMLElement[] => {
      return Array.from(dialog.querySelectorAll<HTMLElement>(selectors)).filter(
        (element) => !element.hasAttribute("disabled") && element.tabIndex !== -1
      );
    };

    const focusables = getFocusableElements();
    focusables[0]?.focus();

    const handleDialogKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setManagementDialogOpen(false);
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const currentFocusables = getFocusableElements();
      if (currentFocusables.length === 0) {
        return;
      }

      const first = currentFocusables[0]!;
      const last = currentFocusables[currentFocusables.length - 1]!;
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    dialog.addEventListener("keydown", handleDialogKeyDown);
    return () => {
      dialog.removeEventListener("keydown", handleDialogKeyDown);
    };
  }, [managementDialogOpen]);

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
    if (!targetServerId) {
      return;
    }

    if (deleteSpaceConfirm.trim() !== "DELETE SPACE") {
      setError("Type DELETE SPACE to confirm.");
      return;
    }

    setMutatingStructure(true);
    setError(null);
    try {
      await deleteServer(targetServerId);
      setDeleteSpaceConfirm("");
      const remainingServers = servers.filter((server) => server.id !== targetServerId);
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
        name: renameRoomName.trim()
      });
      setRenameRoomName("");
      await refreshChatState(selectedServerId, renameRoomId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to rename room.");
    } finally {
      setMutatingStructure(false);
    }
  }

  async function handleDeleteRoom(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!selectedChannelId || !selectedServerId) {
      return;
    }

    if (deleteRoomConfirm.trim() !== "DELETE ROOM") {
      setError("Type DELETE ROOM to confirm.");
      return;
    }

    setMutatingStructure(true);
    setError(null);
    try {
      await deleteChannel({
        channelId: selectedChannelId,
        serverId: selectedServerId
      });
      setDeleteRoomConfirm("");
      await refreshChatState(selectedServerId);
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
          {canManageHubOrSpace ? (
            <button type="button" className="ghost" onClick={() => setManagementDialogOpen(true)}>
              Manage Hub/Space/Room
            </button>
          ) : null}
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

      {managementDialogOpen && canManageHubOrSpace ? (
        <div className="modal-backdrop" role="presentation">
          <section
            className="modal-panel"
            ref={managementDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="management-console-title"
          >
            <header className="modal-header">
              <h2 id="management-console-title">Management Console</h2>
              <button type="button" className="ghost" onClick={() => setManagementDialogOpen(false)}>
                Close
              </button>
            </header>

            <div className="modal-grid">
              <form className="stack manager-form" onSubmit={handleCreateSpace}>
                <label htmlFor="hub-select">Hub</label>
                <select
                  id="hub-select"
                  value={selectedHubIdForCreate ?? ""}
                  onChange={(event) => setSelectedHubIdForCreate(event.target.value || null)}
                  required
                >
                  {hubs.map((hub) => (
                    <option key={hub.id} value={hub.id}>
                      {hub.name}
                    </option>
                  ))}
                </select>
                <label htmlFor="space-name">Create Space</label>
                <input
                  id="space-name"
                  value={spaceName}
                  onChange={(event) => setSpaceName(event.target.value)}
                  minLength={2}
                  maxLength={80}
                  required
                />
                <button type="submit" disabled={creatingSpace || !selectedHubIdForCreate}>
                  {creatingSpace ? "Creating..." : "Create Space"}
                </button>
              </form>

              <form className="stack manager-form" onSubmit={handleCreateCategory}>
                <label htmlFor="category-name">Create Category</label>
                <input
                  id="category-name"
                  value={categoryName}
                  onChange={(event) => setCategoryName(event.target.value)}
                  minLength={2}
                  maxLength={80}
                  required
                />
                <button type="submit" disabled={creatingCategory || !selectedServerId}>
                  {creatingCategory ? "Creating..." : "Create Category"}
                </button>
              </form>

              <form className="stack manager-form" onSubmit={handleCreateRoom}>
                <label htmlFor="room-name">Create Room</label>
                <input
                  id="room-name"
                  value={roomName}
                  onChange={(event) => setRoomName(event.target.value)}
                  minLength={2}
                  maxLength={80}
                  required
                />
                <label htmlFor="room-type">Room Type</label>
                <select
                  id="room-type"
                  value={roomType}
                  onChange={(event) =>
                    setRoomType(event.target.value as "text" | "announcement" | "voice")
                  }
                >
                  <option value="text">Text</option>
                  <option value="announcement">Announcement</option>
                  <option value="voice">Voice</option>
                </select>
                <label htmlFor="room-category">Category</label>
                <select
                  id="room-category"
                  value={selectedCategoryIdForCreate}
                  onChange={(event) => setSelectedCategoryIdForCreate(event.target.value)}
                >
                  <option value="">Uncategorized</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
                <button type="submit" disabled={creatingRoom || !selectedServerId}>
                  {creatingRoom ? "Creating..." : "Create Room"}
                </button>
              </form>

              <form className="stack manager-form" onSubmit={handleRenameSpace}>
                <label htmlFor="rename-space-name">Rename Selected Space</label>
                <input
                  id="rename-space-name"
                  value={renameSpaceName}
                  onChange={(event) => setRenameSpaceName(event.target.value)}
                  minLength={2}
                  maxLength={80}
                  required
                />
                <button type="submit" disabled={mutatingStructure || !renameSpaceId}>
                  {mutatingStructure ? "Saving..." : "Rename Space"}
                </button>
              </form>

              <form className="stack manager-form" onSubmit={handleRenameCategory}>
                <label htmlFor="rename-category-id">Rename Category</label>
                <select
                  id="rename-category-id"
                  value={renameCategoryId}
                  onChange={(event) => {
                    const id = event.target.value;
                    setRenameCategoryId(id);
                    const selected = categories.find((category) => category.id === id);
                    setRenameCategoryName(selected?.name ?? "");
                  }}
                  disabled={categories.length === 0}
                >
                  {categories.length === 0 ? <option value="">No categories</option> : null}
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
                <input
                  value={renameCategoryName}
                  onChange={(event) => setRenameCategoryName(event.target.value)}
                  minLength={2}
                  maxLength={80}
                  required
                />
                <button type="submit" disabled={mutatingStructure || !renameCategoryId || !selectedServerId}>
                  {mutatingStructure ? "Saving..." : "Rename Category"}
                </button>
              </form>

              <form className="stack manager-form" onSubmit={handleRenameRoom}>
                <label htmlFor="rename-room-name">Rename Selected Room</label>
                <input
                  id="rename-room-name"
                  value={renameRoomName}
                  onChange={(event) => setRenameRoomName(event.target.value)}
                  minLength={2}
                  maxLength={80}
                  required
                />
                <button type="submit" disabled={mutatingStructure || !renameRoomId || !selectedServerId}>
                  {mutatingStructure ? "Saving..." : "Rename Room"}
                </button>
              </form>

              <form className="stack manager-form" onSubmit={handleMoveSelectedRoomCategory}>
                <label htmlFor="move-room-category">Move Selected Room to Category</label>
                <select
                  id="move-room-category"
                  value={selectedCategoryIdForCreate}
                  onChange={(event) => setSelectedCategoryIdForCreate(event.target.value)}
                  disabled={!selectedChannelId}
                >
                  <option value="">Uncategorized</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
                <button type="submit" disabled={mutatingStructure || !selectedServerId || !selectedChannelId}>
                  {mutatingStructure ? "Moving..." : "Move Room"}
                </button>
              </form>

              <form className="stack manager-form manager-form-danger" onSubmit={handleDeleteRoom}>
                <label htmlFor="delete-room-confirm">Delete Selected Room</label>
                <input
                  id="delete-room-confirm"
                  value={deleteRoomConfirm}
                  onChange={(event) => setDeleteRoomConfirm(event.target.value)}
                  placeholder="Type DELETE ROOM"
                  required
                />
                <button type="submit" disabled={mutatingStructure || !selectedChannelId}>
                  {mutatingStructure ? "Deleting..." : "Delete Room"}
                </button>
              </form>

              <form className="stack manager-form manager-form-danger" onSubmit={handleDeleteSpace}>
                <label htmlFor="delete-space-target">Target Space</label>
                <select
                  id="delete-space-target"
                  value={deleteTargetSpaceId}
                  onChange={(event) => setDeleteTargetSpaceId(event.target.value)}
                  required
                >
                  {servers.map((server) => (
                    <option key={server.id} value={server.id}>
                      {server.name}
                    </option>
                  ))}
                </select>
                <label htmlFor="delete-space-confirm">Delete Selected Space</label>
                <input
                  id="delete-space-confirm"
                  value={deleteSpaceConfirm}
                  onChange={(event) => setDeleteSpaceConfirm(event.target.value)}
                  placeholder="Type DELETE SPACE"
                  required
                />
                <button type="submit" disabled={mutatingStructure || !deleteTargetSpaceId}>
                  {mutatingStructure ? "Deleting..." : "Delete Space"}
                </button>
              </form>
            </div>
          </section>
        </div>
      ) : null}

      {!viewer ? (
        <section className="panel">
          <h2>Sign In</h2>
          <p>Use developer login for local testing, or configured OAuth providers.</p>
          {activeProvider === "dev" ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                window.location.href = providerLoginUrl("dev", devUsername);
              }}
              className="stack"
            >
              <label htmlFor="dev-username">Developer Username</label>
              <input
                id="dev-username"
                value={devUsername}
                onChange={(event) => setDevUsername(event.target.value)}
                minLength={3}
                maxLength={40}
                required
              />
              <button type="submit">Continue with Developer Login</button>
            </form>
          ) : (
            <a className="button-link" href={providerLoginUrl(activeProvider)}>
              Continue with {activeProvider}
            </a>
          )}
        </section>
      ) : null}

      {viewer && !bootstrapStatus?.initialized ? (
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

      {viewer && bootstrapStatus?.initialized ? (
        <section className="chat-shell" aria-label="Chat workspace">
          <nav className="servers panel" aria-label="Servers">
            <h2>Servers</h2>
            <ul>
              {servers.map((server) => (
                <li key={server.id}>
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
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          <nav className="channels panel" aria-label="Channels">
            <h2>Channels</h2>
            <input
              aria-label="Filter channels"
              placeholder="Search channels"
              value={channelFilter}
              onChange={(event) => setChannelFilter(event.target.value)}
            />
            <ul>
              {groupedChannels.map((group) => (
                <li key={group.id ?? "uncategorized"}>
                  <p className="category-heading">{group.name}</p>
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
                          #{channel.name}
                          {(unreadCountByChannel[channel.id] ?? 0) > 0 ? (
                            <span className="unread-pill">{unreadCountByChannel[channel.id]}</span>
                          ) : null}
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
                {canManageHubOrSpace ? (
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
        </section>
      ) : null}
    </main>
  );
}
