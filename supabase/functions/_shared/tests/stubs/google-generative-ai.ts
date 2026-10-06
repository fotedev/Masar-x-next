/**
 * Offline test double for `https://esm.sh/@google/generative-ai@0.21.0`.
 * Returns canned OCR text; records call count for assertions.
 */
export class GoogleGenerativeAI {
  constructor(_key: string) {
    void _key;
  }
  getGenerativeModel(_opts: unknown) {
    void _opts;
    return {
      generateContent: (_parts: unknown) => {
        void _parts;
        const g = globalThis as unknown as Record<string, { genaiCalls: number }>;
        if (!g.__GENAI__) g.__GENAI__ = { genaiCalls: 0 };
        g.__GENAI__.genaiCalls += 1;
        return Promise.resolve({ response: { text: () => "canned-ocr-text" } });
      },
    };
  }
}
