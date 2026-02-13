import type { ChatMessage } from "@escapehatch/shared";

type ChatMessageListener = (message: ChatMessage) => void;

const channelListeners = new Map<string, Set<ChatMessageListener>>();

export function subscribeToChannelMessages(channelId: string, listener: ChatMessageListener): () => void {
  const listeners = channelListeners.get(channelId) ?? new Set<ChatMessageListener>();
  listeners.add(listener);
  channelListeners.set(channelId, listeners);

  return () => {
    const existing = channelListeners.get(channelId);
    if (!existing) {
      return;
    }

    existing.delete(listener);
    if (existing.size === 0) {
      channelListeners.delete(channelId);
    }
  };
}

export function publishChannelMessage(message: ChatMessage): void {
  const listeners = channelListeners.get(message.channelId);
  if (!listeners || listeners.size === 0) {
    return;
  }

  for (const listener of listeners) {
    listener(message);
  }
}
