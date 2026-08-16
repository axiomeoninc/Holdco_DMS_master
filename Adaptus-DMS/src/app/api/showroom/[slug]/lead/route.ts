// Public showroom lead capture. Creates a customer + lead scoped to the
// dealership resolved from the slug. No auth — the dealership must exist and
// be Active. Honest: consent is required for marketing contact, source is
// always "Website", and webhook delivery is best-effort (never blocks the write).
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/src/lib/supabase-admin";
import { applyConsentTimestamps } from "@/src/lib/customer-consent";
import { scoreLead } from "@/src/lib/business/lead-score";
import { emitDealershipEvent } from "@/src/lib/api/webhooks";

type ShowroomDealershipRow = {
  id: string;
  name: string;
  business_name: string | null;
  status: string | null;
};

async function resolveDealership(slug: string): Promise<{
  dealership: ShowroomDealershipRow | null;
  error: string | null;
  status: number;
}> {
  const { data, error } = await supabaseAdmin
    .from("dealerships")
    .select("id, name, business_name, status")
    .eq("slug", slug)
    .maybeSingle();
  if (error) return { dealership: null, error: error.message, status: 500 };
  if (!data) return { dealership: null, error: "Showroom not found", status: 404 };
  if (data.status !== "Active") {
    return { dealership: null, error: "Showroom is not publicly available", status: 403 };
  }
  return { dealership: data as ShowroomDealershipRow, error: null, status: 200 };
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const resolved = await resolveDealership(slug);
    if (!resolved.dealership) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }
    const dealership = resolved.dealership;

    const body = await req.json().catch(() => ({}));

    // Honeypot: hidden field bots fill. Never processes a "lead" from them.
    if (body.website && typeof body.website === "string" && body.website.length > 0) {
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    const notes = typeof body.notes === "string" ? body.notes.trim() : null;
    const interestVehicleId =
      typeof body.interest_vehicle_id === "string" && body.interest_vehicle_id.trim()
        ? body.interest_vehicle_id.trim()
        : null;
    const marketingConsent = body.marketing_consent === true;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    if (!email && !phone) {
      return NextResponse.json(
        { error: "Provide an email or phone number so we can reply" },
        { status: 400 }
      );
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }
    if (!marketingConsent) {
      return NextResponse.json(
        { error: "Marketing consent is required for contact" },
        { status: 400 }
      );
    }

    // Reuse a contact if one exists by email/phone in this dealership, else create.
    let customerId: string | null = null;
    if (email) {
      const { data: existing } = await supabaseAdmin
        .from("customers")
        .select("id, marketing_consent")
        .eq("email", email)
        .eq("dealership_id", dealership.id)
        .maybeSingle();
      customerId = existing?.id ?? null;
    }
    if (!customerId && phone) {
      const { data: existing } = await supabaseAdmin
        .from("customers")
        .select("id, marketing_consent")
        .eq("phone", phone)
        .eq("dealership_id", dealership.id)
        .maybeSingle();
      customerId = existing?.id ?? null;
    }

    if (!customerId) {
      const customerRow = applyConsentTimestamps(
        {
          name,
          email: email || null,
          phone: phone || null,
          source: "Website",
          notes: notes ? `Showroom inquiry: ${notes}` : "Showroom website inquiry",
          marketing_consent: marketingConsent,
          sms_consent: false,
        },
        null
      );
      const { data: customer, error: customerError } = await supabaseAdmin
        .from("customers")
        .insert({ ...customerRow, dealership_id: dealership.id })
        .select("id")
        .single();
      if (customerError) {
        // Fallback when consent-ip columns missing on older schemas
        const { marketing_consent_ip: _m, sms_consent_ip: _s, ...withoutIp } = customerRow;
        void _m;
        void _s;
        const retry = await supabaseAdmin
          .from("customers")
          .insert({ ...withoutIp, dealership_id: dealership.id })
          .select("id")
          .single();
        if (retry.error) throw retry.error;
        customerId = retry.data.id;
      } else {
        customerId = customer.id;
      }
    }

    const now = new Date().toISOString();
    const scored = scoreLead({
      source: "Website",
      status: "Not Started",
      interest_vehicle_id: interestVehicleId,
      notes,
      last_engagement: now,
      lead_creation_date: now,
    });

    const { data: lead, error: leadError } = await supabaseAdmin
      .from("leads")
      .insert({
        customer_id: customerId,
        interest_vehicle_id: interestVehicleId,
        source: "Website",
        status: "Not Started",
        assigned_to: null,
        notes: notes || "Showroom website inquiry",
        lead_creation_date: now,
        last_engagement: now,
        score: scored.score,
        temperature: scored.temperature,
        dealership_id: dealership.id,
      })
      .select("id, customer_id, source, status, interest_vehicle_id")
      .single();

    if (leadError) throw leadError;

    // Fire-and-forget webhook; failures never fail the lead write.
    void emitDealershipEvent({
      dealershipId: dealership.id,
      event: "lead.created",
      payload: {
        lead_id: lead.id,
        customer_id: lead.customer_id,
        source: lead.source,
        status: lead.status,
        interest_vehicle_id: lead.interest_vehicle_id,
      },
    }).catch((err: unknown) =>
      console.error("showroom lead.created webhook dispatch failed:", err)
    );

    const dealershipName = dealership.business_name || dealership.name;
    return NextResponse.json({
      ok: true,
      message: `Request received — ${dealershipName} will be in touch.`,
    });
  } catch (error: unknown) {
    console.error("Showroom lead capture error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
