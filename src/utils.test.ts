import { add, toUpperCase } from "./utils";

describe("Utils", () => {
  describe("add", () => {
    it("두 숫자를 더합니다", () => {
      expect(add(1, 2)).toBe(3);
      expect(add(-1, 1)).toBe(0);
      expect(add(0, 0)).toBe(0);
    });
  });

  describe("toUpperCase", () => {
    it("문자열을 대문자로 변환합니다", () => {
      expect(toUpperCase("hello")).toBe("HELLO");
      expect(toUpperCase("")).toBe("");
      expect(toUpperCase("Hello World")).toBe("HELLO WORLD");
    });
  });
});
