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
            <style jsx global>{`
              [data-sonner-toast] [data-close-button] {
                top: 50% !important;
                right: 8px !important;
                transform: translateY(-50%) !important;
                left: auto !important;
              }
              [dir="rtl"] [data-sonner-toast] [data-close-button] {
                left: 8px !important;
                right: auto !important;
              }
              @media (max-width: 640px) {
                [data-sonner-toast] {
                  --mobile-offset: 16px;
                }
              }
            `}</style>
            <Layout>{children}</Layout>
            <Toaster 
              position="top-center" 
              dir={dir} 
              richColors 
              closeButton 
              gap={8}
              toastOptions={{
                style: {
                  fontSize: '14px',
                  borderRadius: '12px',
                  padding: '12px 16px',
                  paddingInlineEnd: '40px',
                },
                className: "max-sm:!w-[95vw] max-sm:!mx-auto",
              }}
            />
          </NotificationProvider>
        </ThemeProvider>
      </QueryProvider>
    </AuthProvider>
  );
}
