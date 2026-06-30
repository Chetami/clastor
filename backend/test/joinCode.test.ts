import { describe, expect, it } from "vitest";
import {
  generateJoinCode,
  JOIN_CODE_LENGTH,
} from "../src/utils/joinCode";

describe("generateJoinCode", () => {
  it("has the configured length", () => {
    expect(generateJoinCode()).toHaveLength(JOIN_CODE_LENGTH);
  });

  it("is uppercase + digits only", () => {
    for (let i = 0; i < 50; i++) {
      expect(generateJoinCode()).toMatch(/^[A-Z0-9]+$/);
    }
  });

  it("excludes ambiguous characters (0, O, 1, I, L)", () => {
    const ambiguous = ["0", "O", "1", "I", "L"];
    for (let i = 0; i < 50; i++) {
      const code = generateJoinCode();
      for (const ch of ambiguous) {
        expect(code).not.toContain(ch);
      }
    }
  });

  it("produces varied codes (not a constant)", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 20; i++) seen.add(generateJoinCode());
    expect(seen.size).toBeGreaterThan(1);
  });
});
