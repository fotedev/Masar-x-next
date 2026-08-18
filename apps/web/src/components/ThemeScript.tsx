"use client";

import Script from "next/script";

interface ThemeScriptProps {
  siteUrl: string;
  assistantName: string;
  nonce?: string;
}

export default function ThemeScript({
  siteUrl,
  assistantName,
  nonce,
}: ThemeScriptProps) {
  return (
    <>
      <Script
        id="schema-org"
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: "MasarX",
            url: siteUrl,
            description: `Study summaries, quizzes, courses, and ${assistantName} AI assistant platform`,
          }),
        }}
      />
      <Script
        id="theme-initializer"
        strategy="afterInteractive"
        nonce={nonce}
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
    </>
  );
}
