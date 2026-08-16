import { NextRequest, NextResponse } from "next/server";
import { requireTenantClient } from "@/src/lib/auth-helpers";
import {
    applyTenantScope,
    tenantScopeFromRequest,
    tenantScopeHttpError,
} from "@/src/lib/tenant-scope";

export async function GET(req: NextRequest) {
    try {
        const tenant = await requireTenantClient(req);
        if (!tenant.ok) return tenant.response;
        const { supabase } = tenant;
        const scope = tenantScopeFromRequest(tenant, req);

        const url = new URL(req.url);
        const customerId = url.searchParams.get("customer_id");
        const documentType = url.searchParams.get("document_type");

        let query = applyTenantScope(
            supabase
                .from("ocr_documents")
                .select("*")
                .order("created_at", { ascending: false }),
            scope,
            "ocr_documents"
        );

        if (customerId) {
            query = query.eq("customer_id", customerId);
        }
        if (documentType) {
            query = query.eq("document_type", documentType);
        }

        const { data, error } = await query;

        if (error) throw error;

        return Response.json({ data });
    } catch (error) {
        const scoped = tenantScopeHttpError(error);
        if (scoped) {
            return Response.json({ error: scoped.error }, { status: scoped.status });
        }
        console.error("Error fetching OCR documents:", error);
        return Response.json({ error: "Failed to fetch documents" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const tenant = await requireTenantClient(req);
        if (!tenant.ok) return tenant.response;
        const { auth, supabase, isPlatformAdmin } = tenant;
        const currentUser = auth.profile;
        const user = auth.user;

        const body = await req.json();

        // Validate required fields
        const validTypes = ["drivers_license", "government_id", "passport", "other"];
        if (!body.document_type || !validTypes.includes(body.document_type)) {
            return NextResponse.json(
                { error: `document_type is required and must be one of: ${validTypes.join(", ")}` },
                { status: 400 }
            );
        }

        // Whitelist allowed fields (must match schema.sql ocr_documents columns)
        const allowed = [
            "customer_id", "document_type", "document_number",
            "first_name", "last_name", "date_of_birth", "expiry_date",
            "address", "city", "province", "postal_code", "issue_date", "country",
            "raw_ocr_text", "confidence_score", "image_url"
        ];
        const docData: Record<string, unknown> = {
            dealership_id: currentUser.dealership_id,
            verified_by: user.id,
        };
        for (const field of allowed) {
            if (body[field] !== undefined) {
                docData[field] = body[field];
            }
        }

        const { data, error } = await supabase
            .from("ocr_documents")
            .insert(docData)
            .select()
            .single();

        if (error) throw error;

        return Response.json({ data }, { status: 201 });
    } catch (error: unknown) {
        console.error("Error creating OCR document:", error);
        return Response.json({ error: error instanceof Error ? error.message : "Failed to create document" }, { status: 500 });
    }
}
