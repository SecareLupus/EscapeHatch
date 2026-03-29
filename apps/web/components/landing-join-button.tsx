"use client";

import React, { useMemo, useState } from "react";
import { useChat } from "../context/chat-context";
import { useToast } from "./toast-provider";
import { joinServer } from "../lib/control-plane";
import { Server } from "@skerry/shared";

interface LandingJoinButtonProps {
    serverId: string;
}

export function LandingJoinButton({ serverId }: LandingJoinButtonProps) {
    const { state, dispatch } = useChat();
    const { showToast } = useToast();
    const [isJoining, setIsJoining] = useState(false);

    const server = useMemo(() => state.servers.find(s => s.id === serverId), [state.servers, serverId]);
    
    // Check if user is already a member. 
    // In our system, if the server is in state.servers, it's typically because they are a member 
    // or it's the current "preview" server.
    // However, a better check might be roles.
    const isMember = useMemo(() => {
        return state.viewerRoles.some(r => r.serverId === serverId);
    }, [state.viewerRoles, serverId]);

    const joinPolicy = server?.joinPolicy || "open";

    const handleJoin = async () => {
        if (isMember || isJoining) return;

        setIsJoining(true);
        try {
            await joinServer(serverId);
            // Refresh bootstrap or servers list? 
            // For now, let's just show a toast and hope the sync picks it up.
            // Ideally we'd have a 'REFRESH_SERVERS' action or similar.
            showToast(
                joinPolicy === "approval" 
                    ? "Application sent! An admin will review your request." 
                    : "Welcome to the space!", 
                "success"
            );
            
            // Note: In a real app, we might need to manually trigger a re-fetch of bootstrap data 
            // or roles if the websocket doesn't immediately push the new membership.
        } catch (err: any) {
            showToast(err.message || "Failed to join space", "error");
        } finally {
            setIsJoining(false);
        }
    };

    if (isMember) {
        return (
            <button className="landing-join-btn joined" disabled>
                Joined
            </button>
        );
    }

    const label = joinPolicy === "approval" ? "Apply to Join" : "Join Space";

    return (
        <button 
            className={`landing-join-btn ${joinPolicy}`} 
            onClick={handleJoin}
            disabled={isJoining}
        >
            {isJoining ? "Joining..." : label}
        </button>
    );
}
