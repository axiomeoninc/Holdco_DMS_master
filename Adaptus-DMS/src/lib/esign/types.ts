/**
 * E-signature shared types.
 *
 * Honest electronic signature: typed name + initials + explicit consent with a
 * server-captured timestamp. This is NOT a "wet signature" and never claims to
 * be one — the record states plainly that it is an electronic signature.
 */

export type EsignDocumentType = "bill_of_sale" | "quotation" | "we_owe" | "invoice";

export const ESIGN_DOCUMENT_TYPES: EsignDocumentType[] = [
    "bill_of_sale",
    "quotation",
    "we_owe",
    "invoice",
];

export type EsignSignerRole = "buyer" | "seller" | "manager";

export const ESIGN_SIGNER_ROLES: EsignSignerRole[] = ["buyer", "seller", "manager"];

export interface EsignInput {
    document_type: EsignDocumentType;
    document_id: string;
    signer_name: string;
    signer_initials: string;
    signer_role: EsignSignerRole;
    /** Exact acknowledgment text the signer checked. Stored verbatim. */
    consent_text: string;
}

export interface EsignRecord extends EsignInput {
    id: string;
    dealership_id: string | null;
    consent_timestamp: string;
    ip_address: string | null;
    user_agent: string | null;
    created_by: string | null;
    created_at: string;
}

/** Standard consent acknowledgment for the in-app sign flow. */
export const ESIGN_DEFAULT_CONSENT_TEXT =
    "I agree that by typing my name and initials and clicking Agree and Sign, " +
    "this is my electronic signature and I consent to sign this document electronically.";
