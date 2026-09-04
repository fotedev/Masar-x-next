/**
 * MathText - renders text that may contain LaTeX math via a WebView
 * running KaTeX auto-render (CDN), auto-sized to its content.
 *
 * Raw-text fallback (kept in code, not just in a comment): if the
 * WebView fails to load (offline CDN, embedded runtime error) we swap
 * to a plain <Text> render of the raw string, so the message content
 * is always visible - worst case unrendered.
 */
import React, { useCallback, useMemo, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";

const KATEX_VERSION = "0.16.11";
const KATEX_BASE = "https://cdn.jsdelivr.net/npm/katex@" + KATEX_VERSION + "/dist";

/**
 * KaTeX auto-render bootstrap: render math (inline $...$ / \\(...\\),
 * display $$...$$ / \\[...\\]), then report the document height back to
 * React Native so the WebView container can size itself exactly.
 */
const INJECTED_JS = `
  (function () {
    function send() {
      var h = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: "height", value: h }));
    }
    function render() {
      try {
        if (window.renderMathInElement) {
          window.renderMathInElement(document.body, {
            delimiters: [
              { left: "$$", right: "$$", display: true },
              { left: "\\\\[", right: "\\\\]", display: true },
              { left: "\\\\(", right: "\\\\)", display: false },
              { left: "$", right: "$", display: false }
            ],
            throwOnError: false
          });
        }
      } catch (e) {}
      requestAnimationFrame(function () {
        send();
        setTimeout(send, 350);
      });
    }
    if (window.renderMathInElement) {
      render();
    } else {
      window.addEventListener("load", render);
      setTimeout(render, 1500);
    }
  })();
`;

function escapeHtml(input: string): string {
  return input.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export interface MathTextProps {
  text: string;
  /** Paragraph direction (follows the app locale). */
  rtl?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export default function MathText({ text, rtl = false, style, textStyle }: MathTextProps) {
  const [failed, setFailed] = useState(false);
  const [height, setHeight] = useState<number | null>(null);

  const html = useMemo(() => {
    const body = escapeHtml(text).replace(/\r?\n/g, "<br/>");
    const dir = rtl ? "rtl" : "ltr";
    return (
      '<!DOCTYPE html><html><head><meta charset="utf-8" />' +
      '<meta name="viewport" content="width=device-width, initial-scale=1" />' +
      '<link rel="stylesheet" href="' + KATEX_BASE + '/katex.min.css" />' +
      '<script defer src="' + KATEX_BASE + '/katex.min.js"></script>' +
      '<script defer src="' + KATEX_BASE + '/contrib/auto-render.min.js"></script>' +
      '<style>html,body{margin:0;padding:8px 12px;background:transparent;' +
      'font-family:-apple-system,"Segoe UI",Roboto,sans-serif;font-size:15px;' +
      'line-height:1.55;direction:' + dir + ';text-align:start;overflow-wrap:break-word;}</style>' +
      "</head><body>" + body + "</body></html>"
    );
  }, [text, rtl]);

  // Rough first-paint height; replaced by the measured height once the
  // page reports back via postMessage.
  const initialHeight = useMemo(
    () => Math.min(520, 44 + Math.ceil(text.length / 48) * 22),
    [text.length],
  );

  const onMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data) as { type?: string; value?: number };
      if (data.type === "height" && typeof data.value === "number" && data.value > 0) {
        setHeight(Math.min(Math.ceil(data.value) + 12, 900));
      }
    } catch {
      // Ignore malformed messages from the page.
    }
  }, []);

  if (failed) {
    // Raw-text fallback: show the unrendered string rather than nothing.
    return (
      <View style={style}>
        <Text style={[styles.fallback, rtl && { writingDirection: "rtl" as const }, textStyle]}>
          {text}
        </Text>
      </View>
    );
  }

  return (
    <View style={[style, { height: height ?? initialHeight }]}>
      <WebView
        source={{ html, baseUrl: "https://cdn.jsdelivr.net" }}
        originWhitelist={["*"]}
        scrollEnabled={false}
        onMessage={onMessage}
        onError={() => setFailed(true)}
        injectedJavaScript={INJECTED_JS}
        style={styles.webview}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  webview: { flex: 1, backgroundColor: "transparent" },
  fallback: { fontSize: 15, lineHeight: 22, color: "#111827" },
});