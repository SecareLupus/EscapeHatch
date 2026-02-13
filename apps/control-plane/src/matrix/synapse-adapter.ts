import { config } from "../config.js";
import type { ChannelType } from "@escapehatch/shared";

interface CreateSpaceInput {
  name: string;
}

interface CreateRoomInput {
  name: string;
  type: ChannelType;
}

async function synapseRequest<T>(path: string, body: Record<string, unknown>): Promise<T | null> {
  if (!config.synapse.baseUrl || !config.synapse.accessToken) {
    return null;
  }

  const response = await fetch(`${config.synapse.baseUrl}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.synapse.accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`Synapse request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function createSpace(input: CreateSpaceInput): Promise<string | null> {
  const response = await synapseRequest<{ room_id: string }>("/_matrix/client/v3/createRoom", {
    name: input.name,
    creation_content: { type: "m.space" },
    preset: "private_chat",
    power_level_content_override: { users_default: 0 },
    initial_state: [
      {
        type: "m.room.history_visibility",
        state_key: "",
        content: { history_visibility: "joined" }
      },
      {
        type: "m.room.join_rules",
        state_key: "",
        content: { join_rule: "invite" }
      }
    ]
  });

  return response?.room_id ?? null;
}

export async function createChannelRoom(input: CreateRoomInput): Promise<string | null> {
  const response = await synapseRequest<{ room_id: string }>("/_matrix/client/v3/createRoom", {
    name: input.name,
    topic: `${input.type} channel provisioned by control-plane`,
    preset: "private_chat",
    initial_state: [
      {
        type: "m.room.history_visibility",
        state_key: "",
        content: { history_visibility: "joined" }
      },
      {
        type: "m.room.join_rules",
        state_key: "",
        content: { join_rule: "invite" }
      }
    ]
  });

  return response?.room_id ?? null;
}

export async function attachChildRoom(spaceId: string, childRoomId: string): Promise<void> {
  if (!config.synapse.baseUrl || !config.synapse.accessToken) {
    return;
  }

  const response = await fetch(
    `${config.synapse.baseUrl}/_matrix/client/v3/rooms/${encodeURIComponent(
      spaceId
    )}/state/m.space.child/${encodeURIComponent(childRoomId)}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${config.synapse.accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ via: [new URL(config.synapse.baseUrl).hostname] })
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to attach child room to space (${response.status})`);
  }
}
