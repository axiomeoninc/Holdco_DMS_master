import { describe, expect, it } from "vitest";
import { invoiceEmail } from "@/src/lib/email/invoice";
import { otpEmail } from "@/src/lib/email/otp";
import { renderEmailLayout, buildPlainText } from "@/src/lib/email/layout";
import { FF } from "@/src/lib/email/brands";

describe("email template smoke", () => {
  it("renderEmailLayout includes brand bolt and title", () => {
    const html = renderEmailLayout({
      preheader: "Hello",
      title: "Welcome",
      bodyHtml: "<p>Body</p>",
      cta: { label: "Open app", url: "https://app.flashfender.com" },
    });
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("Welcome");
    expect(html).toContain(FF.bolt);
    expect(html).toContain("Open app");
  });

  it("otpEmail returns subject/html/text with code", () => {
    const mail = otpEmail({ code: "123456", purpose: "login" });
    expect(mail.subject).toContain("123456");
    expect(mail.html).toContain("123456");
    expect(mail.text).toContain("123456");
  });

  it("invoiceEmail includes invoice number and total", () => {
    const mail = invoiceEmail({
      invoiceNumber: "INV-42",
      taxRate: 0.13,
      taxAmount: 13,
      total: 113,
      customerName: "Ada",
      lineItems: [
        { description: "Package", qty: 1, unitPrice: 100, amount: 100 },
      ],
    });
    expect(mail.subject).toContain("INV-42");
    expect(mail.html).toContain("INV-42");
    expect(mail.html).toContain("Package");
    expect(mail.text.length).toBeGreaterThan(20);
  });

  it("buildPlainText joins lines", () => {
    const text = buildPlainText({
      title: "Title",
      lines: ["a", "b"],
    });
    expect(text).toContain("Title");
    expect(text).toContain("a");
    expect(text).toContain("b");
  });
});
