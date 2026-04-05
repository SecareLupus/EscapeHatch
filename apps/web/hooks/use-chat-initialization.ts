"use client";

import { useCallback, useEffect, useRef } from "react";
import { useChat, MessageItem } from "../context/chat-context";
import { useToast } from "../components/toast-provider";
import { 
  fetchAuthProviders, 
  fetchViewerSession, 
  fetchBootstrapStatus, 
  listViewerRoleBindings, 
  listHubs, 
  listBlocks,
  listServers,
  listChannels,
  listCategories,
  listDiscordBridgeMappings,
  fetchDiscordBridgeHealth,
  listMessages,
  listMessagesAround,
  listChannelMembers,
  updateUserTheme,
  controlPlaneBaseUrl,
  type ChatMessage
} from "../lib/control-plane";

interface UseChatInitializationProps {
  urlServerId: string | null;
  urlChannelId: string | null;
  urlMessageId: string | null;
  setUrlSelection: (serverId: string | null, channelId: string | null, messageId?: string | null) => void;
  markChannelAsRead: (channelId: string) => Promise<void>;
  messagesRef: React.RefObject<HTMLOListElement>;
  setDraftMessage: (msg: string) => void;
  lastSyncedUrlRef: React.MutableRefObject<string>;
}

export function useChatInitialization({
  urlServerId,
  urlChannelId,
  urlMessageId,
  setUrlSelection,
  markChannelAsRead,
  messagesRef,
  setDraftMessage,
  lastSyncedUrlRef
}: UseChatInitializationProps) {
  const { state, dispatch } = useChat();
  const { showToast } = useToast();
  
  const { 
    viewer, 
    bootstrapStatus, 
    selectedServerId, 
    selectedChannelId, 
    draftMessagesByChannel, 
    channelScrollPositions,
    theme
  } = state;

  const chatStateRequestIdRef = useRef(0);
  const initialChatLoadKeyRef = useRef<string | null>(null);

  const refreshAuthState = useCallback(async (): Promise<void> => {
    try {
      const providerData = await fetchAuthProviders();
      dispatch({ type: "SET_PROVIDERS", payload: providerData });
    } catch (cause) {
      console.error("Failed to load auth providers:", cause);
      const message = cause instanceof Error ? cause.message : "Failed to load auth providers.";
      dispatch({ type: "SET_ERROR", payload: `${message} (Target: ${controlPlaneBaseUrl}/auth/providers)` });
    }

    const viewerData = await fetchViewerSession();
    dispatch({ type: "SET_VIEWER", payload: viewerData });

    try {
      const bootstrapData = await fetchBootstrapStatus();
      dispatch({ type: "SET_BOOTSTRAP_STATUS", payload: bootstrapData });
    } catch (cause) {
      console.error("Failed to load bootstrap status:", cause);
    }

    void listViewerRoleBindings()
      .then((roleBindings) => dispatch({ type: "SET_VIEWER_ROLES", payload: roleBindings }))
      .catch(() => dispatch({ type: "SET_VIEWER_ROLES", payload: [] }));

    void listHubs()
      .then((items) => {
        dispatch({ type: "SET_HUBS", payload: items });
      })
      .catch(() => dispatch({ type: "SET_HUBS", payload: [] }));

    void listBlocks()
      .then((items) => dispatch({ type: "SET_BLOCKED_USER_IDS", payload: items }))
      .catch(() => dispatch({ type: "SET_BLOCKED_USER_IDS", payload: [] }));
  }, [dispatch]);

  const refreshChatState = useCallback(async (preferredServerId?: string, preferredChannelId?: string): Promise<void> => {
    const requestId = ++chatStateRequestIdRef.current;
    const [serverItems, roleBindings] = await Promise.all([
      listServers(),
      listViewerRoleBindings()
    ]);
    if (requestId !== chatStateRequestIdRef.current) return;

    dispatch({ type: "SET_SERVERS", payload: serverItems });
    dispatch({ type: "SET_VIEWER_ROLES", payload: roleBindings });

    const candidateServerId = preferredServerId ?? urlServerId ?? selectedServerId ?? serverItems[0]?.id ?? null;
    const nextServerId = candidateServerId && serverItems.some((server) => server.id === candidateServerId)
        ? candidateServerId
        : (serverItems[0]?.id ?? null);
    
    dispatch({ type: "SET_SELECTED_SERVER_ID", payload: nextServerId });

    if (!nextServerId) {
      dispatch({ type: "SET_CHANNELS", payload: [] });
      dispatch({ type: "SET_CATEGORIES", payload: [] });
      dispatch({ type: "SET_SELECTED_CHANNEL_ID", payload: null });
      dispatch({ type: "SET_MESSAGES", payload: [] });
      setUrlSelection(null, null);
      return;
    }

    dispatch({ type: "SET_CHANNELS", payload: [] });
    dispatch({ type: "SET_CATEGORIES", payload: [] });

    const channelItems = await listChannels(nextServerId);
    if (requestId !== chatStateRequestIdRef.current) return;
    const categoryItems = await listCategories(nextServerId);
    if (requestId !== chatStateRequestIdRef.current) return;

    dispatch({ type: "SET_CHANNELS", payload: channelItems });
    dispatch({ type: "SET_CATEGORIES", payload: categoryItems });

    void listDiscordBridgeMappings(nextServerId)
      .then((items) => dispatch({ type: "SET_DISCORD_MAPPINGS", payload: items }))
      .catch(() => dispatch({ type: "SET_DISCORD_MAPPINGS", payload: [] }));

    void fetchDiscordBridgeHealth(nextServerId)
      .then((health) => dispatch({ type: "SET_DISCORD_CONNECTION", payload: health.connection }))
      .catch(() => dispatch({ type: "SET_DISCORD_CONNECTION", payload: null }));

    const textChannels = channelItems.filter((channel) => channel.type === "text" || channel.type === "announcement");

    let nextChannelId = selectedChannelId;
    let shouldFetchMessages = false;

    if (preferredChannelId || urlChannelId) {
      const explicitId = preferredChannelId ?? urlChannelId;
      if (explicitId && channelItems.some((c) => c.id === explicitId)) {
        nextChannelId = explicitId;
        shouldFetchMessages = true;
      }
    }

    if (!nextChannelId) {
      nextChannelId = textChannels[0]?.id ?? channelItems[0]?.id ?? null;
      shouldFetchMessages = true;
    }

    if (nextChannelId !== selectedChannelId) {
      dispatch({ type: "SET_SELECTED_CHANNEL_ID", payload: nextChannelId });
    }

    if (nextChannelId && (shouldFetchMessages || !selectedChannelId)) {
      const nextChannelObj = channelItems.find(c => c.id === nextChannelId);
      if (nextChannelObj) {
        dispatch({ type: "SET_ACTIVE_CHANNEL_DATA", payload: nextChannelObj });
      }
    }

    setUrlSelection(nextServerId, nextChannelId, urlMessageId);
    lastSyncedUrlRef.current = `${nextServerId}:${nextChannelId}:${urlMessageId}`;

    if (!nextChannelId) {
      dispatch({ type: "SET_MESSAGES", payload: [] });
      return;
    }

    if (shouldFetchMessages) {
      let messageItems: ChatMessage[];
      if (urlMessageId) {
        messageItems = await listMessagesAround(nextChannelId, urlMessageId);
        if (messageItems.length === 0) {
          messageItems = await listMessages(nextChannelId, null);
          dispatch({ type: "SET_HIGHLIGHTED_MESSAGE_ID", payload: null });
          setUrlSelection(nextServerId, nextChannelId, null);
          lastSyncedUrlRef.current = `${nextServerId}:${nextChannelId}:null`;
        } else {
          dispatch({ type: "SET_HIGHLIGHTED_MESSAGE_ID", payload: urlMessageId });
        }
      } else {
        messageItems = await listMessages(nextChannelId, null);
        dispatch({ type: "SET_HIGHLIGHTED_MESSAGE_ID", payload: null });
      }

      if (requestId !== chatStateRequestIdRef.current) return;
      dispatch({ type: "SET_MESSAGES", payload: messageItems.map((message) => ({ ...message })) });

      setDraftMessage(draftMessagesByChannel[nextChannelId] ?? "");

      setTimeout(() => {
        const list = messagesRef.current;
        if (list) {
          if (urlMessageId) return;
          const savedPos = channelScrollPositions[nextChannelId];
          if (savedPos !== undefined) {
            list.scrollTop = savedPos;
          } else {
            list.scrollTop = list.scrollHeight;
          }
        }
      }, 0);
    }

    if (nextChannelId) {
      void listChannelMembers(nextChannelId)
        .then((items) => dispatch({ type: "SET_MEMBERS", payload: items }))
        .catch((e) => console.error("Failed to fetch members:", e));
    } else {
      dispatch({ type: "SET_MEMBERS", payload: [] });
    }
  }, [urlServerId, urlChannelId, urlMessageId, selectedServerId, selectedChannelId, dispatch, setUrlSelection, lastSyncedUrlRef, setDraftMessage, draftMessagesByChannel, channelScrollPositions, messagesRef]);

  const handleServerChange = useCallback(async (serverId: string, channelId?: string): Promise<void> => {
    const targetChannelId = channelId ?? state.lastChannelByServer[serverId];
    dispatch({ type: "SET_SELECTED_SERVER_ID", payload: serverId });
    localStorage.setItem("lastServerId", serverId);
    if (targetChannelId) localStorage.setItem("lastChannelId", targetChannelId);

    try {
      await refreshChatState(serverId, targetChannelId);
    } catch (cause) {
      dispatch({ type: "SET_ERROR", payload: cause instanceof Error ? cause.message : "Failed to load channels." });
    }
  }, [state.lastChannelByServer, dispatch, refreshChatState]);

  const handleChannelChange = useCallback(async (channelId: string): Promise<void> => {
    const channel = state.channels.find(c => c.id === channelId);
    if (channel) dispatch({ type: "SET_ACTIVE_CHANNEL_DATA", payload: channel });

    if (selectedChannelId) {
      // Accessing draftMessage from outside might be tricky, maybe we pass it as a getter or just trust the context
      // For now, let's assume the draft is updated in context before change
    }

    dispatch({ type: "SET_SELECTED_CHANNEL_ID", payload: channelId });
    if (selectedServerId) {
      dispatch({ type: "SET_LAST_CHANNEL_BY_SERVER", payload: { serverId: selectedServerId, channelId } });
    }
    localStorage.setItem("lastChannelId", channelId);

    setUrlSelection(selectedServerId, channelId);
    lastSyncedUrlRef.current = `${selectedServerId}:${channelId}:null`;

    setDraftMessage(draftMessagesByChannel[channelId] ?? "");

    dispatch({ type: "SET_ERROR", payload: null });
    try {
      const next = await listMessages(channelId, null);
      dispatch({ type: "SET_MESSAGES", payload: next.map((message) => ({ ...message })) });

      void listChannelMembers(channelId)
        .then((items) => dispatch({ type: "SET_MEMBERS", payload: items }))
        .catch((e) => console.error("Failed to fetch members on channel change:", e));

      setTimeout(() => {
        const list = messagesRef.current;
        if (list) {
          const savedPos = channelScrollPositions[channelId];
          if (savedPos !== undefined) {
            list.scrollTop = savedPos;
          } else {
            list.scrollTop = list.scrollHeight;
          }
        }
      }, 0);

      void markChannelAsRead(channelId);
    } catch (cause) {
      dispatch({ type: "SET_ERROR", payload: cause instanceof Error ? cause.message : "Failed to load messages." });
    }
  }, [state.channels, selectedChannelId, selectedServerId, dispatch, setUrlSelection, lastSyncedUrlRef, setDraftMessage, draftMessagesByChannel, channelScrollPositions, messagesRef, markChannelAsRead]);

  const initialize = useCallback(async (): Promise<void> => {
    dispatch({ type: "SET_LOADING", payload: true });
    dispatch({ type: "SET_ERROR", payload: null });
    try {
      await refreshAuthState();
      if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
        void Notification.requestPermission();
      }
    } catch (cause) {
      const msg = cause instanceof Error ? cause.message : "Failed to load auth state.";
      dispatch({ type: "SET_ERROR", payload: msg });
      showToast(msg, "error");
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  }, [refreshAuthState, dispatch, showToast]);

  return {
    refreshAuthState,
    refreshChatState,
    handleServerChange,
    handleChannelChange,
    initialize,
    initialChatLoadKeyRef
  };
}
