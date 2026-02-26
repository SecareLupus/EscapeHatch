import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "EscapeHatch Hub",
  description: "Creator co-op Matrix hub"
};

import { ToastProvider } from "../components/toast-provider";
import { ChatProvider } from "../context/chat-context";
import { AppInitializer } from "../components/app-initializer";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ToastProvider>
          <ChatProvider>
            <AppInitializer>
              {children}
            </AppInitializer>
          </ChatProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
