import { Client, GatewayIntentBits, Events, Message } from "discord.js";
import { config } from "../config.js";
import { relayDiscordMessageToMappedChannel } from "./discord-bridge-service.js";
import { logEvent } from "./observability-service.js";
import { withDb } from "../db/client.js";

let client: Client | null = null;

export async function startDiscordBot() {
    if (config.discordBridge.mockMode || !config.discordBotToken || config.discordBotToken === "REPLACE_ME_IN_PORTAL") {
        logEvent("info", "discord_bot_skipped", { reason: config.discordBridge.mockMode ? "mock_mode" : "missing_token" });
        return;
    }

    client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent
        ]
    });

    client.once(Events.ClientReady, (readyClient: Client<true>) => {
        logEvent("info", "discord_bot_ready", { tag: readyClient.user.tag });
    });

    client.on(Events.MessageCreate, async (message: Message) => {
        if (message.author.bot) return;

        // Find all servers that have a mapping for this Discord channel
        const serverIds = await withDb(async (db) => {
            const rows = await db.query<{ server_id: string }>(
                "select server_id from discord_bridge_channel_mappings where guild_id = $1 and discord_channel_id = $2 and enabled = true",
                [message.guildId, message.channelId]
            );
            return rows.rows.map(r => r.server_id);
        });

        if (serverIds.length === 0) return;

        for (const serverId of serverIds) {
            try {
                await relayDiscordMessageToMappedChannel({
                    serverId,
                    discordChannelId: message.channelId,
                    authorName: message.author.username,
                    content: message.content,
                    mediaUrls: message.attachments.map((a: { url: string }) => a.url)
                });
            } catch (error) {
                logEvent("error", "discord_relay_failed", { serverId, messageId: message.id, error: String(error) });
            }
        }
    });

    try {
        await client.login(config.discordBotToken);
    } catch (error) {
        logEvent("error", "discord_bot_login_failed", { error: String(error) });
    }
}

export function getDiscordBotClient() {
    return client;
}

export async function relayMatrixMessageToDiscord(input: {
    serverId: string;
    discordChannelId: string;
    authorName: string;
    content: string;
}) {
    if (!client || !client.isReady()) return;

    try {
        const channel = await client.channels.fetch(input.discordChannelId);
        if (channel && "send" in channel && typeof channel.send === "function") {
            await (channel as any).send(`**[Matrix] ${input.authorName}**: ${input.content}`);
        }
    } catch (error) {
        logEvent("error", "discord_outbound_relay_failed", { error: String(error) });
    }
}
