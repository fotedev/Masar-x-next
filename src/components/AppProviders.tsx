"use client";

import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { NotificationProvider } from "@/components/NotificationManager";
import { Layout } from "@/components/Layout";
import { Toaster } from "sonner";
import { QueryProvider } from "@/components/QueryProvider";

type Props = {
  children: React.ReactNode;
  dir: "rtl" | "ltr";
};

export function AppProviders({ children, dir }: Props) {
  return (
    <AuthProvider>
      <QueryProvider>
        <ThemeProvider>
          <NotificationProvider>
            <Layout>{children}</Layout>
            <Toaster position="top-center" dir={dir} richColors />
          </NotificationProvider>
        </ThemeProvider>
      </QueryProvider>
    </AuthProvider>
  );
}
