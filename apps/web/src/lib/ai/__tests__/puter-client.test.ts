import { describe, expect, it } from "vitest";
import { extractPuterChatText } from "../puter-client";

describe("extractPuterChatText", () => {
  it("returns plain string responses verbatim", async () => {
    await expect(extractPuterChatText("hello")).resolves.toBe("hello");
  });

  it("extracts string message content", async () => {
    await expect(
      extractPuterChatText({ message: { content: "answer" } }),
    ).resolves.toBe("answer");
  });

  it("extracts Claude-style content arrays", async () => {
    await expect(
      extractPuterChatText({
        message: {
          content: [
            { type: "text", text: "a" },
            { type: "text", text: "b" },
          ],
        },
      }),
    ).resolves.toBe("ab");
  });

  it("THROWS on error responses instead of returning them as content (P1.10)", async () => {
    await expect(extractPuterChatText({ error: "boom" })).rejects.toThrow("boom");
    await expect(
      extractPuterChatText({ error: { message: "inner boom" } }),
    ).rejects.toThrow("inner boom");
    await expect(extractPuterChatText({ message: "error text" })).rejects.toThrow(
      "error text",
    );
  });

  it("stringifies opaque non-error objects via the safe fallback", async () => {
    await expect(extractPuterChatText({ text: "fallback" })).resolves.toBe(
      '{"text":"fallback"}',
    );
  });

  it("consumes async iterators of chunks", async () => {
    const stream = (async function* () {
      yield { text: "he" };
      yield { text: "llo" };
    })();
    await expect(extractPuterChatText(stream)).resolves.toBe("hello");
  });
});
