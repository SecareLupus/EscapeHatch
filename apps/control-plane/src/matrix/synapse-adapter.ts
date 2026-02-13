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

  let response: Response;
  try {
    response = await fetch(`${config.synapse.baseUrl}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.synapse.accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
  } catch (error) {
    const message = `Synapse request network failure: ${
      error instanceof Error ? error.message : "unknown error"
    }`;
    if (config.synapse.strictProvisioning) {
      throw new Error(message);
    }
    console.warn(`${message}; continuing without Synapse provisioning.`);
    return null;
  }

  if (!response.ok) {
    const message = `Synapse request failed: ${response.status}`;
    if (config.synapse.strictProvisioning) {
      throw new Error(message);
    }
    console.warn(`${message}; continuing without Synapse provisioning.`);
    return null;
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

  let response: Response;
  try {
    response = await fetch(
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
  } catch (error) {
    const message = `Synapse linkage network failure: ${
      error instanceof Error ? error.message : "unknown error"
    }`;
    if (config.synapse.strictProvisioning) {
      throw new Error(message);
    }
    console.warn(`${message}; continuing without Synapse linkage.`);
    return;
  }

  if (!response.ok) {
    const message = `Failed to attach child room to space (${response.status})`;
    if (config.synapse.strictProvisioning) {
      throw new Error(message);
    }
    console.warn(`${message}; continuing without Synapse linkage.`);
  }
}
