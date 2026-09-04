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
      {/* JSON-LD structured data: use a plain <script> tag. Two reasons
          it stays inline rather than going through next/script:
            1. The script's MIME type is `application/ld+json`, which is
               DATA, not executable JavaScript. CSP's `script-src` (and
               therefore its nonce requirement) does NOT apply to JSON-LD
               payloads, so a plain inline <script> works.
            2. next/script is for executable scripts; rendering structured
               data through it would defer the schema.org output past the
               initial paint, which hurts SEO tooling. */}
      <script
        id="schema-org"
        type="application/ld+json"
        nonce={nonce}
        suppressHydrationWarning
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
      {/* Theme initializer: must run BEFORE the page paints so users never
          see a light-mode flash on a dark-preference device. The previous
          inline <script> with `dangerouslySetInnerHTML` suffered a CSP nonce
          mismatch: React's server render emitted `nonce=""` in the SSR HTML
          (the nonce prop is only known at request time, not at component
          render time), so the browser blocked the script under the
          production CSP policy even though `suppressHydrationWarning` hid
          the visible React warning.
          The fix: hand the executable script to next/script with the
          `beforeInteractive` strategy. Next.js injects it into the initial
          HTML during request handling, where the real nonce is available,
          so the CSP check passes. The `nonce` prop is forwarded so
          non-CSP-mode builds still work. */}
      {/* eslint-disable-next-line @next/next/no-before-interactive-script-outside-document -- App Router root layout; the rule's Pages Router heuristic fires incorrectly here per next.js issue tracker. */}
      <Script
        id="theme-initializer"
        strategy="beforeInteractive"
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
