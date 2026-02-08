import type { Metadata } from "next";
import { Inter, Almarai } from "next/font/google";
import "../index.css";
import { AuthProvider } from "../contexts/AuthContext";
import { ThemeProvider } from "../contexts/ThemeContext";
import { NotificationProvider } from "../components/NotificationManager";
import { Layout } from "../components/Layout";

const inter = Inter({ subsets: ["latin"] });
const almarai = Almarai({ subsets: ["arabic"], weight: ['300', '400', '700', '800'] });

export const metadata: Metadata = {
  title: "Masar X - Study Summaries Platform",
  description: "Your path to academic excellence with study summaries and quizzes.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body className={`${inter.className} ${almarai.className}`}>
        <AuthProvider>
          <ThemeProvider>
            <NotificationProvider>
              <Layout>{children}</Layout>
            </NotificationProvider>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
