/**
 * E-signature input validation.
 *
 * Server-side validation is mandatory: the signer must type a name and
 * initials, select a role, and explicitly consent. The consent timestamp is
 * captured server-side at insert time — never trusted from the client.
 */

import type { EsignDocumentType, EsignInput, EsignSignerRole } from "./types";
import { ESIGN_DOCUMENT_TYPES, ESIGN_SIGNER_ROLES } from "./types";

export class EsignValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "EsignValidationError";
    }
}

export function validateEsignInput(
    body: Record<string, unknown>
): EsignInput {
    const document_type = String(body.document_type ?? "").trim() as EsignDocumentType;
    const document_id = String(body.document_id ?? "").trim();
    const signer_name = String(body.signer_name ?? "").trim();
    const signer_initials = String(body.signer_initials ?? "").trim();
    const signer_role = String(body.signer_role ?? "").trim() as EsignSignerRole;
    const consent_text = String(body.consent_text ?? "").trim();

    if (!ESIGN_DOCUMENT_TYPES.includes(document_type)) {
        throw new EsignValidationError(
            `document_type must be one of: ${ESIGN_DOCUMENT_TYPES.join(", ")}`
        );
    }
    if (!document_id || !/^[0-9a-f-]{8,64}$/i.test(document_id)) {
        throw new EsignValidationError("document_id is required");
    }
    if (!signer_name || signer_name.length < 2) {
        throw new EsignValidationError(
            "signer_name must be the typed full name (at least 2 characters)"
        );
    }
    if (!signer_initials || signer_initials.length > 8) {
        throw new EsignValidationError(
            "signer_initials must be provided (up to 8 characters)"
        );
    }
    if (!ESIGN_SIGNER_ROLES.includes(signer_role)) {
        throw new EsignValidationError(
            `signer_role must be one of: ${ESIGN_SIGNER_ROLES.join(", ")}`
        );
    }
    if (!consent_text || consent_text.length < 20) {
        throw new EsignValidationError(
            "consent_text must be the full acknowledgment text the signer accepted"
        );
    }

    return { document_type, document_id, signer_name, signer_initials, signer_role, consent_text };
}
