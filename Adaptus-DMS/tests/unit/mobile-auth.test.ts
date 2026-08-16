import { describe, expect, it } from "vitest";
import {
  parseBearerAuthorization,
  parseMobileLoginBody,
  parseMobileRefreshBody,
  parsePushTokenBody,
} from "@/src/lib/mobile-auth-parse";

describe("parseBearerAuthorization", () => {
  it("extracts the token from a Bearer header", () => {
    expect(parseBearerAuthorization("Bearer abc.def.ghi")).toBe("abc.def.ghi");
    expect(parseBearerAuthorization("bearer token-1")).toBe("token-1");
  });

  it("returns null for missing or malformed headers", () => {
    expect(parseBearerAuthorization(null)).toBeNull();
    expect(parseBearerAuthorization("")).toBeNull();
    expect(parseBearerAuthorization("Basic abc")).toBeNull();
    expect(parseBearerAuthorization("Bearer")).toBeNull();
    expect(parseBearerAuthorization("Bearer ")).toBeNull();
  });
});

describe("parseMobileLoginBody", () => {
  it("normalizes email and requires password", () => {
    expect(
      parseMobileLoginBody({ email: "  A@B.com ", password: "secret" })
    ).toEqual({
      ok: true,
      value: { email: "a@b.com", password: "secret" },
    });
  });

  it("rejects invalid payloads", () => {
    expect(parseMobileLoginBody(null).ok).toBe(false);
    expect(parseMobileLoginBody({ email: "nope", password: "x" }).ok).toBe(false);
    expect(parseMobileLoginBody({ email: "a@b.com" }).ok).toBe(false);
    expect(parseMobileLoginBody({ password: "x" }).ok).toBe(false);
  });
});

describe("parseMobileRefreshBody", () => {
  it("allows empty / cookie-only refresh", () => {
    expect(parseMobileRefreshBody(null)).toEqual({ ok: true, value: {} });
    expect(parseMobileRefreshBody({})).toEqual({ ok: true, value: {} });
    expect(parseMobileRefreshBody({ refresh_token: "" })).toEqual({
      ok: true,
      value: {},
    });
  });

  it("accepts a string refresh_token", () => {
    expect(parseMobileRefreshBody({ refresh_token: "  rt-1  " })).toEqual({
      ok: true,
      value: { refresh_token: "rt-1" },
    });
  });

  it("rejects non-string refresh_token", () => {
    expect(parseMobileRefreshBody({ refresh_token: 123 }).ok).toBe(false);
    expect(parseMobileRefreshBody("nope").ok).toBe(false);
  });
});

describe("parsePushTokenBody", () => {
  it("accepts ios and android", () => {
    expect(
      parsePushTokenBody({ token: " expo-push ", platform: "ios" })
    ).toEqual({
      ok: true,
      value: { token: "expo-push", platform: "ios" },
    });
    expect(
      parsePushTokenBody({ token: "t", platform: "android" }).ok
    ).toBe(true);
  });

  it("rejects missing token or unknown platform", () => {
    expect(parsePushTokenBody(null).ok).toBe(false);
    expect(parsePushTokenBody({ token: "t", platform: "web" }).ok).toBe(false);
    expect(parsePushTokenBody({ platform: "ios" }).ok).toBe(false);
  });
});
