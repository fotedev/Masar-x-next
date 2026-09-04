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
          see a light-mode flash on a dark-preference device.
          We use a standard <script> tag with suppressHydrationWarning instead
          of next/script <Script> because:
            1. next/script is designed for external scripts (with src). For inline scripts,
               browsers empty the DOM nonce attribute after script execution per the
               W3C CSP specification (nonce hiding).
            2. next/script does not suppress this attribute change during hydration,
               triggering a React hydration mismatch error (nonce="" vs nonce="...").
            3. A native <script> tag with suppressHydrationWarning correctly tells React
               to ignore this browser-level attribute modification while keeping the nonce
               valid for CSP execution during initial HTML parsing. */}
      <script
        id="theme-initializer"
        nonce={nonce}
        suppressHydrationWarning
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
