import { describe, expect, it } from "vitest";
import {
  ESIGN_DEFAULT_CONSENT_TEXT,
  EsignValidationError,
  validateEsignInput,
} from "@/src/lib/esign";

const valid = {
  document_type: "bill_of_sale",
  document_id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  signer_name: "Jane Doe",
  signer_initials: "JD",
  signer_role: "buyer",
  consent_text: ESIGN_DEFAULT_CONSENT_TEXT,
};

describe("esign validateEsignInput", () => {
  it("accepts a valid signature input", () => {
    const out = validateEsignInput(valid);
    expect(out.signer_name).toBe("Jane Doe");
    expect(out.signer_role).toBe("buyer");
  });

  it("rejects unknown document types", () => {
    expect(() =>
      validateEsignInput({ ...valid, document_type: "lease" })
    ).toThrow(EsignValidationError);
  });

  it("rejects short / missing names", () => {
    expect(() => validateEsignInput({ ...valid, signer_name: "" })).toThrow();
    expect(() => validateEsignInput({ ...valid, signer_name: "X" })).toThrow();
  });

  it("rejects missing initials and invalid roles", () => {
    expect(() => validateEsignInput({ ...valid, signer_initials: "" })).toThrow();
    expect(() =>
      validateEsignInput({ ...valid, signer_role: "lawyer" })
    ).toThrow();
  });

  it("requires the full consent text (honesty guardrail)", () => {
    expect(() =>
      validateEsignInput({ ...valid, consent_text: "ok" })
    ).toThrow(EsignValidationError);
  });

  it("trims whitespace from typed fields", () => {
    const out = validateEsignInput({
      ...valid,
      signer_name: "  Jane Doe  ",
      signer_initials: " JD ",
    });
    expect(out.signer_name).toBe("Jane Doe");
    expect(out.signer_initials).toBe("JD");
  });
});
