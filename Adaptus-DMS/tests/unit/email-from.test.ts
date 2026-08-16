import { afterEach, describe, expect, it } from "vitest";
import { resolveEmailFrom } from "@/src/lib/email/from";
import { isResendConfigured } from "@/src/lib/resend";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("resolveEmailFrom", () => {
  it("formats a bare dealer override with the display name", () => {
    const resolved = resolveEmailFrom({
      email_from: "sales@acme.com",
      display_name: "Acme Motors",
    });
    expect(resolved.from).toBe("Acme Motors <sales@acme.com>");
    expect(resolved.source).toBe("dealer");
  });

  it("passes through an already-formatted dealer override", () => {
    const resolved = resolveEmailFrom({
      email_from: "Acme Motors <sales@acme.com>",
    });
    expect(resolved.from).toBe("Acme Motors <sales@acme.com>");
    expect(resolved.source).toBe("dealer");
  });

  it("falls back to EMAIL_FROM env without a dealer override", () => {
    process.env.EMAIL_FROM = "env@example.com";
    const resolved = resolveEmailFrom({});
    expect(resolved.from).toBe("env@example.com");
    expect(resolved.source).toBe("env");
  });

  it("falls back to the honest default", () => {
    delete process.env.EMAIL_FROM;
    const resolved = resolveEmailFrom({});
    expect(resolved.source).toBe("default");
    expect(resolved.from).toContain("@");
  });
});

describe("isResendConfigured", () => {
  it("zero-arg requires RESEND_API_KEY and EMAIL_FROM", () => {
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
    expect(isResendConfigured()).toBe(false);

    process.env.RESEND_API_KEY = "re_xxx";
    expect(isResendConfigured()).toBe(false);

    process.env.EMAIL_FROM = "env@example.com";
    expect(isResendConfigured()).toBe(true);
  });

  it("honours a dealership email_from when EMAIL_FROM env is absent", () => {
    process.env.RESEND_API_KEY = "re_xxx";
    delete process.env.EMAIL_FROM;
    expect(isResendConfigured({ email_from: "sales@acme.com" })).toBe(true);
  });

  it("ignores a dealer override when RESEND_API_KEY is missing", () => {
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
    expect(isResendConfigured({ email_from: "sales@acme.com" })).toBe(false);
  });

  it("zero-arg ignores a dealer override (historical behavior)", () => {
    process.env.RESEND_API_KEY = "re_xxx";
    delete process.env.EMAIL_FROM;
    expect(isResendConfigured()).toBe(false);
  });
});
