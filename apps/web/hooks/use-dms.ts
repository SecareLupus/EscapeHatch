"use client";

import { useEffect } from "react";
import { useChat } from "../context/chat-context";
import { listChannels } from "../lib/control-plane";

export function useDMs() {
  const { state, dispatch } = useChat();
  const { viewer, servers, bootstrapStatus } = state;

  const dmServerId = servers.find((s) => s.type === "dm")?.id;
  const canAccessWorkspace = Boolean(viewer && !viewer.needsOnboarding && bootstrapStatus?.initialized);

  useEffect(() => {
    if (!canAccessWorkspace || !dmServerId) return;

    const refreshDmChannels = () => {
      listChannels(dmServerId)
        .then((channels) => dispatch({ type: "SET_ALL_DM_CHANNELS", payload: channels }))
        .catch(console.error);
    };

    refreshDmChannels();
    const timer = setInterval(refreshDmChannels, 60000); // refresh every minute just in case
    return () => clearInterval(timer);
  }, [canAccessWorkspace, dmServerId, dispatch]);
}
