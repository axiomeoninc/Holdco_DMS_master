// app/api/esign/signatures/route.ts
// Dealership-scoped electronic signature capture.
// POST — record a signature (typed name + initials + consent timestamp).
// GET  — list signatures for a document (document_type, document_id).

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/src/lib/supabase-admin";
import {
    assertOwnershipOrDeny,
    requireDealershipAccess,
} from "@/src/lib/auth-helpers";
import { canEdit } from "@/src/lib/permission-middleware";
import {
    ESIGN_DOCUMENT_TYPES,
    validateEsignInput,
} from "@/src/lib/esign";
import { logAudit } from "@/src/lib/audit";
import type { EsignDocumentType } from "@/src/lib/esign";

type Supabase = typeof supabaseAdmin;

const DOCUMENT_TABLE: Record<EsignDocumentType, string> = {
    bill_of_sale: "bill_of_sale",
    quotation: "quotations",
    we_owe: "bill_of_sale", // we-owe records ride on the bill_of_sale document
    invoice: "invoices",
};

const EDIT_RESOURCE: Record<EsignDocumentType, string> = {
    bill_of_sale: "deals",
    quotation: "quotations",
    we_owe: "deals",
    invoice: "invoices",
};

async function fetchDocument(
    supabase: Supabase,
    documentType: EsignDocumentType,
    documentId: string
): Promise<{ row: { id: string; dealership_id?: string | null; [k: string]: unknown } | null; error: string | null }> {
    const table = DOCUMENT_TABLE[documentType];
    const { data, error } = await supabase
        .from(table)
        .select("id, dealership_id")
        .eq("id", documentId)
        .single();
    if (error) {
        if (error.code === "PGRST116") return { row: null, error: null };
        return { row: null, error: error.message };
    }
    return { row: data as never, error: null };
}

export async function GET(req: NextRequest) {
    try {
        const auth = await requireDealershipAccess(req);
        if (auth.error || !auth.profile) {
            return NextResponse.json(
                { error: auth.error || "Unauthorized" },
                { status: auth.status || 401 }
            );
        }

        const url = new URL(req.url);
        const documentType = url.searchParams.get("document_type");
        const documentId = url.searchParams.get("document_id");

        if (
            !documentType ||
            !ESIGN_DOCUMENT_TYPES.includes(documentType as EsignDocumentType)
        ) {
            return NextResponse.json(
                { error: "document_type is required" },
                { status: 400 }
            );
        }
        if (!documentId) {
            return NextResponse.json(
                { error: "document_id is required" },
                { status: 400 }
            );
        }

        const supabase = supabaseAdmin;
        let query = supabase
            .from("esign_signatures")
            .select(
                "id, dealership_id, document_type, document_id, signer_name, signer_initials, signer_role, consent_text, consent_timestamp, ip_address, user_agent, created_by, created_at"
            )
            .eq("document_type", documentType)
            .eq("document_id", documentId)
            .order("created_at", { ascending: false });
        if (auth.profile.dealership_id) {
            query = query.eq("dealership_id", auth.profile.dealership_id);
        }

        const { data, error } = await query;
        if (error) throw error;

        return NextResponse.json({ data: data || [] });
    } catch (error: unknown) {
        console.error("Error listing e-signatures:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}

export async function POST(req: NextRequest) {
    try {
        const auth = await requireDealershipAccess(req);
        if (auth.error || !auth.profile) {
            return NextResponse.json(
                { error: auth.error || "Unauthorized" },
                { status: auth.status || 401 }
            );
        }

        let body: Record<string, unknown>;
        try {
            body = (await req.json()) as Record<string, unknown>;
        } catch {
            return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
        }

        let input;
        try {
            input = validateEsignInput(body);
        } catch (err) {
            return NextResponse.json(
                { error: err instanceof Error ? err.message : "Invalid signature input" },
                { status: 400 }
            );
        }

        const supabase = supabaseAdmin;

        // Document must exist and belong to the caller's dealership.
        const { row, error: docError } = await fetchDocument(
            supabase,
            input.document_type,
            input.document_id
        );
        if (docError) throw docError;
        const deny = assertOwnershipOrDeny(row, auth.profile);
        if (deny) return deny;

        if (
            !canEdit(
                auth.profile.role,
                auth.profile.user_permissions || [],
                EDIT_RESOURCE[input.document_type],
                auth.profile.is_platform_admin
            )
        ) {
            return NextResponse.json(
                { error: "Forbidden - You cannot record signatures on this document" },
                { status: 403 }
            );
        }

        const dealershipId =
            row?.dealership_id || auth.profile.dealership_id || null;
        const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
        const userAgent = req.headers.get("user-agent") || null;
        const consentTimestamp = new Date().toISOString();

        const { data: record, error: insertError } = await supabase
            .from("esign_signatures")
            .insert({
                dealership_id: dealershipId,
                document_type: input.document_type,
                document_id: input.document_id,
                signer_name: input.signer_name,
                signer_initials: input.signer_initials,
                signer_role: input.signer_role,
                consent_text: input.consent_text,
                consent_timestamp: consentTimestamp,
                ip_address: ip,
                user_agent: userAgent,
                created_by: auth.profile.id,
            })
            .select()
            .single();

        if (insertError) {
            if (insertError.code === "23505") {
                return NextResponse.json(
                    {
                        error:
                            "This document already has a signature for that signer role. Void the existing record or pick another role.",
                    },
                    { status: 409 }
                );
            }
            throw insertError;
        }

        // Signature state on the document itself.
        if (input.document_type === "bill_of_sale" || input.document_type === "we_owe") {
            await supabase
                .from("bill_of_sale")
                .update({
                    signed_at: consentTimestamp,
                    signed_by_name: input.signer_name,
                    ...(input.document_type === "bill_of_sale" ? { status: "Signed" } : {}),
                })
                .eq("id", input.document_id);
        } else if (input.document_type === "quotation") {
            await supabase
                .from("quotations")
                .update({
                    signed_at: consentTimestamp,
                    signed_by_name: input.signer_name,
                })
                .eq("id", input.document_id);
        } else if (input.document_type === "invoice") {
            await supabase
                .from("invoices")
                .update({
                    signed_at: consentTimestamp,
                    signed_by_name: input.signer_name,
                })
                .eq("id", input.document_id);
        }

        await logAudit(supabase, {
            action: "document.sign",
            entity_type: "document",
            entity_id: input.document_id,
            actor_id: auth.profile.id,
            actor_email: auth.profile.email,
            actor_role: auth.profile.role,
            dealership_id: dealershipId,
            ip_address: ip,
            user_agent: userAgent,
            metadata: {
                document_type: input.document_type,
                signer_name: input.signer_name,
                signer_role: input.signer_role,
                signature_id: (record as { id?: string })?.id,
                consent_timestamp: consentTimestamp,
            },
        });

        return NextResponse.json(
            {
                data: record,
                document: {
                    id: input.document_id,
                    signed_at: consentTimestamp,
                    signed_by_name: input.signer_name,
                },
            },
            { status: 201 }
        );
    } catch (error: unknown) {
        console.error("Error recording e-signature:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}
