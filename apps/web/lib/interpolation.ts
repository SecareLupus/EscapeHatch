import type { Channel, Server, Hub } from "@skerry/shared";

export interface InterpolationContext {
    hub?: Hub;
    server?: Server;
    channel?: Channel;
    memberCount?: number;
    viewerName?: string;
}

/**
 * Processes interpolation tokens in a string (usually HTML).
 * Supported tokens:
 * - {{hubName}}
 * - {{serverName}}
 * - {{channelName}}
 * - {{memberCount}}
 * - {{viewerName}}
 * - {{ownerName}}
 */
export function processInterpolation(content: string, context: InterpolationContext): string {
    if (!content) return "";

    const tokens: Record<string, string> = {
        "{{hubName}}": context.hub?.name || "",
        "{{serverName}}": context.server?.name || "",
        "{{channelName}}": context.channel?.name || "",
        "{{memberCount}}": context.memberCount?.toString() || "0",
        "{{viewerName}}": context.viewerName || "Guest",
    };

    let result = content;
    for (const [token, value] of Object.entries(tokens)) {
        // Use a global regex to replace all occurrences
        const regex = new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        result = result.replace(regex, value);
    }

    return result;
}
