import type { Metadata } from "next";
import { Inter, Almarai } from "next/font/google";
import "../index.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { NotificationProvider } from "@/components/NotificationManager";
import { Layout } from "@/components/Layout";
import { Toaster } from "sonner";
import { QueryProvider } from "@/components/QueryProvider";

const inter = Inter({ subsets: ["latin"] });
const almarai = Almarai({
  subsets: ["arabic"],
  weight: ["300", "400", "700", "800"],
});

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://masarx.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Masar X - Study Summaries Platform",
    template: "%s | Masar X",
  },
  description:
    "Your path to academic excellence with study summaries, quizzes, courses, and AI assistance.",
  keywords: [
    "Masar X",
    "ملخصات",
    "مسار اكس",
    "مسار",
    "مسار-اكس",
    "Masar-X",
    "منصة مسار اكس",
    "منصة مسار",
    "منصة مسار-اكس",
    "masar platform",
  ],
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "Masar X",
    title: "Masar X - Study Summaries Platform",
    description:
      "Your path to academic excellence with study summaries, quizzes, courses, and AI assistance.",
    images: [
      {
        url: "/logo.png",
        width: 512,
        height: 512,
        alt: "Masar X",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Masar X - Study Summaries Platform",
    description:
      "Your path to academic excellence with study summaries, quizzes, courses, and AI assistance.",
    images: ["/logo.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ar"
      dir="rtl"
      suppressHydrationWarning
      style={{ overflowX: "clip" }}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('theme');
                  var supportDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches === true;
                  if (!theme && supportDarkMode) theme = 'dark';
                  if (!theme) theme = 'light';
                  document.documentElement.classList.toggle('dark', theme === 'dark');
                  document.documentElement.style.colorScheme = theme;
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body
        className={`${inter.className} ${almarai.className} min-h-screen bg-slate-50 dark:bg-brand-navy antialiased`}
        suppressHydrationWarning
      >
        <AuthProvider>
          <QueryProvider>
            <ThemeProvider>
              <NotificationProvider>
                <Layout>{children}</Layout>
                <Toaster position="top-center" dir="rtl" richColors />
              </NotificationProvider>
            </ThemeProvider>
          </QueryProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
