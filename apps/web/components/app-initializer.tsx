"use client";

import React, { useEffect, useCallback, useRef } from "react";
import { useChat } from "../context/chat-context";
import {
    fetchAuthProviders,
    fetchViewerSession,
    fetchBootstrapStatus,
    listViewerRoleBindings,
    listHubs,
    listServers
} from "../lib/control-plane";

export function AppInitializer({ children }: { children: React.ReactNode }) {
    const { dispatch } = useChat();
    const initializedRef = useRef(false);

    const refreshGlobalState = useCallback(async (): Promise<void> => {
        try {
            const [providers, viewer, bootstrap, roles, hubs, servers] = await Promise.all([
                fetchAuthProviders().catch(() => null),
                fetchViewerSession().catch(() => null),
                fetchBootstrapStatus().catch(() => null),
                listViewerRoleBindings().catch(() => []),
                listHubs().catch(() => []),
                listServers().catch(() => [])
            ]);

            if (providers) dispatch({ type: "SET_PROVIDERS", payload: providers });
            if (viewer) dispatch({ type: "SET_VIEWER", payload: viewer });
            if (bootstrap) dispatch({ type: "SET_BOOTSTRAP_STATUS", payload: bootstrap });
            dispatch({ type: "SET_VIEWER_ROLES", payload: roles });
            dispatch({ type: "SET_HUBS", payload: hubs.map(h => ({ id: h.id, name: h.name })) });
            dispatch({ type: "SET_SERVERS", payload: servers });
        } catch (err) {
            console.error("Global initialization failed:", err);
        }
    }, [dispatch]);

    useEffect(() => {
        if (initializedRef.current) return;
        initializedRef.current = true;
        
        async function init() {
            dispatch({ type: "SET_LOADING", payload: true });
            await refreshGlobalState();
            dispatch({ type: "SET_LOADING", payload: false });
        }
        void init();
    }, [refreshGlobalState, dispatch]);

    return <>{children}</>;
}
