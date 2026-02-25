import { ChatClient } from "../components/chat-client";
import { ChatProvider } from "../context/chat-context";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <ChatProvider>
      <ChatClient />
    </ChatProvider>
  );
}
