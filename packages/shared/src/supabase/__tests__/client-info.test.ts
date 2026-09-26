import { describe, expect, it } from "vitest";
import { buildClientInfo } from "../client-info";

describe("buildClientInfo", () => {
  it("renders the platform=…; app_version=… contract shape", () => {
    expect(buildClientInfo("web", "0.5.6")).toBe(
      "platform=web; app_version=0.5.6",
    );
    expect(buildClientInfo("desktop", "1.2.3")).toBe(
      "platform=desktop; app_version=1.2.3",
    );
    expect(buildClientInfo("mobile", "0.7.0")).toBe(
      "platform=mobile; app_version=0.7.0",
    );
  });
});
