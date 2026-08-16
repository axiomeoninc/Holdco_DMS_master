// CRM email sequence helpers (Resend-backed). Never invents sends when secrets missing.

import { crmEmail } from "@/src/lib/email";
import { isResendConfigured, sendEmail } from "@/src/lib/resend";
import { resolveEmailFrom } from "@/src/lib/email/from";
import { buildUnsubscribeUrl } from "@/src/lib/casl-unsubscribe";
import type { SupabaseClient } from "@supabase/supabase-js";

export type SequenceStepInput = {
  step_order: number;
  delay_days: number;
  subject: string;
  body_html: string;
  body_text?: string | null;
};

export type DefaultNurtureStep = SequenceStepInput;

export const DEFAULT_LEAD_NURTURE_NAME = "Lead nurture (3-step)";

export const DEFAULT_LEAD_NURTURE_STEPS: DefaultNurtureStep[] = [
  {
    step_order: 1,
    delay_days: 0,
    subject: "Thanks for your interest — {{dealership}}",
    body_html: `
      <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111">
        <p style="margin:0 0 12px">Hi {{first_name}},</p>
        <p style="margin:0 0 12px">Thanks for reaching out to <strong>{{dealership}}</strong>. We've noted your interest{{vehicle_clause}} and a team member is ready to help.</p>
        <p style="margin:0 0 12px">Reply to this email anytime, or call us when you're free.</p>
        <p style="margin:0;color:#666;font-size:13px">— {{dealership}}</p>
      </div>
    `.trim(),
    body_text:
      "Hi {{first_name}},\n\nThanks for reaching out to {{dealership}}. We've noted your interest{{vehicle_clause}} and a team member is ready to help.\n\nReply anytime.\n\n— {{dealership}}",
  },
  {
    step_order: 2,
    delay_days: 2,
    subject: "Still looking? {{dealership}} is here to help",
    body_html: `
      <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111">
        <p style="margin:0 0 12px">Hi {{first_name}},</p>
        <p style="margin:0 0 12px">Just checking in from <strong>{{dealership}}</strong>. If you're still shopping{{vehicle_clause}}, we can set up a visit or answer questions by email.</p>
        <p style="margin:0 0 12px">No pressure — reply when it works for you.</p>
        <p style="margin:0;color:#666;font-size:13px">— {{dealership}}</p>
      </div>
    `.trim(),
    body_text:
      "Hi {{first_name}},\n\nJust checking in from {{dealership}}. If you're still shopping{{vehicle_clause}}, we can set up a visit or answer questions by email.\n\n— {{dealership}}",
  },
  {
    step_order: 3,
    delay_days: 5,
    subject: "Ready when you are — {{dealership}}",
    body_html: `
      <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111">
        <p style="margin:0 0 12px">Hi {{first_name}},</p>
        <p style="margin:0 0 12px">This is our last follow-up for now from <strong>{{dealership}}</strong>. If timing wasn't right, keep us in mind — we're happy to help when you're ready.</p>
        <p style="margin:0 0 12px">If you'd rather not hear from us about this inquiry, reply with STOP and we'll close the sequence.</p>
        <p style="margin:0;color:#666;font-size:13px">— {{dealership}}</p>
      </div>
    `.trim(),
    body_text:
      "Hi {{first_name}},\n\nThis is our last follow-up for now from {{dealership}}. If timing wasn't right, keep us in mind.\n\nReply STOP to close this sequence.\n\n— {{dealership}}",
  },
];

export type TemplateVars = {
  first_name: string;
  dealership: string;
  vehicle_label: string | null;
};

export function renderTemplate(template: string, vars: TemplateVars): string {
  const vehicleClause = vars.vehicle_label
    ? ` in the ${vars.vehicle_label}`
    : "";
  return template
    .replaceAll("{{first_name}}", vars.first_name || "there")
    .replaceAll("{{dealership}}", vars.dealership || "our dealership")
    .replaceAll("{{vehicle_clause}}", vehicleClause)
    .replaceAll(
      "{{vehicle}}",
      vars.vehicle_label || "the vehicle you asked about"
    );
}

export function addDaysIso(fromMs: number, days: number): string {
  return new Date(fromMs + days * 24 * 60 * 60 * 1000).toISOString();
}

export type EnsureDefaultResult =
  | { ok: true; sequenceId: string; created: boolean }
  | { ok: false; error: string };

/** Ensure dealership has the default 3-step lead nurture sequence. */
export async function ensureDefaultLeadNurtureSequence(
  supabase: SupabaseClient,
  opts: { dealershipId: string; userId: string }
): Promise<EnsureDefaultResult> {
  const { data: existing, error: findErr } = await supabase
    .from("email_sequences")
    .select("id")
    .eq("dealership_id", opts.dealershipId)
    .eq("name", DEFAULT_LEAD_NURTURE_NAME)
    .maybeSingle();

  if (findErr) {
    return { ok: false, error: findErr.message };
  }

  if (existing?.id) {
    return { ok: true, sequenceId: existing.id, created: false };
  }

  const { data: created, error: createErr } = await supabase
    .from("email_sequences")
    .insert({
      dealership_id: opts.dealershipId,
      name: DEFAULT_LEAD_NURTURE_NAME,
      description:
        "Default lead follow-up: thank-you, day-2 check-in, day-5 close. Email only (Resend).",
      is_active: true,
      created_by: opts.userId,
    })
    .select("id")
    .single();

  if (createErr || !created) {
    return { ok: false, error: createErr?.message || "Failed to create sequence" };
  }

  const steps = DEFAULT_LEAD_NURTURE_STEPS.map((s) => ({
    sequence_id: created.id,
    step_order: s.step_order,
    delay_days: s.delay_days,
    subject: s.subject,
    body_html: s.body_html,
    body_text: s.body_text ?? null,
  }));

  const { error: stepsErr } = await supabase
    .from("email_sequence_steps")
    .insert(steps);

  if (stepsErr) {
    return { ok: false, error: stepsErr.message };
  }

  return { ok: true, sequenceId: created.id, created: true };
}

export type RecipientContext = {
  toEmail: string;
  firstName: string;
  dealershipName: string;
  vehicleLabel: string | null;
  marketingConsent: boolean;
};

export type SendNextResult =
  | {
      ok: true;
      status: "sent" | "skipped" | "completed";
      sendId?: string;
      resendId?: string;
      message?: string;
    }
  | {
      ok: false;
      error: string;
      missingConfig?: boolean;
      code?:
        | "NOT_CONFIGURED"
        | "NO_EMAIL"
        | "NO_CONSENT"
        | "STOPPED"
        | "NO_STEP"
        | "SEND_FAILED";
    };

/**
 * Send the next pending step for an active enrollment.
 * Logs success/fail; never reports ok when Resend is missing.
 */
export async function sendNextSequenceStep(
  supabase: SupabaseClient,
  opts: {
    enrollmentId: string;
    dealershipId: string;
    recipient: RecipientContext;
    /** When true, ignore next_send_at (manual "Send next"). */
    force?: boolean;
  }
): Promise<SendNextResult> {
  const { data: enrollment, error: enrErr } = await supabase
    .from("email_sequence_enrollments")
    .select("*")
    .eq("id", opts.enrollmentId)
    .eq("dealership_id", opts.dealershipId)
    .maybeSingle();

  if (enrErr || !enrollment) {
    return { ok: false, error: enrErr?.message || "Enrollment not found" };
  }

  if (enrollment.status !== "active") {
    return {
      ok: false,
      code: "STOPPED",
      error: `Enrollment is ${enrollment.status}`,
    };
  }

  if (!opts.force && enrollment.next_send_at) {
    const due = new Date(enrollment.next_send_at).getTime();
    if (Number.isFinite(due) && due > Date.now()) {
      return {
        ok: true,
        status: "skipped",
        message: `Next step scheduled for ${enrollment.next_send_at}. Use Send next to send now.`,
      };
    }
  }

  const nextOrder = (enrollment.current_step || 0) + 1;

  const { data: step, error: stepErr } = await supabase
    .from("email_sequence_steps")
    .select("*")
    .eq("sequence_id", enrollment.sequence_id)
    .eq("step_order", nextOrder)
    .maybeSingle();

  if (stepErr) {
    return { ok: false, error: stepErr.message };
  }

  if (!step) {
    await supabase
      .from("email_sequence_enrollments")
      .update({
        status: "completed",
        next_send_at: null,
        stopped_at: new Date().toISOString(),
        stop_reason: "completed",
      })
      .eq("id", enrollment.id);
    return { ok: true, status: "completed", message: "Sequence already complete" };
  }

  if (!opts.recipient.toEmail) {
    await supabase.from("email_sequence_sends").insert({
      dealership_id: opts.dealershipId,
      enrollment_id: enrollment.id,
      step_id: step.id,
      step_order: step.step_order,
      to_email: "",
      status: "skipped",
      error: "No recipient email",
    });
    // Stop so cron/send-due does not re-insert skipped rows every hour.
    await supabase
      .from("email_sequence_enrollments")
      .update({
        status: "stopped",
        next_send_at: null,
        stopped_at: new Date().toISOString(),
        stop_reason: "no_email",
      })
      .eq("id", enrollment.id);
    return {
      ok: false,
      code: "NO_EMAIL",
      error: "Customer has no email address",
    };
  }

  if (!opts.recipient.marketingConsent) {
    await supabase.from("email_sequence_sends").insert({
      dealership_id: opts.dealershipId,
      enrollment_id: enrollment.id,
      step_id: step.id,
      step_order: step.step_order,
      to_email: opts.recipient.toEmail,
      status: "skipped",
      error: "marketing_consent=false",
    });
    // Stop so due cron cannot spam skipped rows while consent stays false.
    await supabase
      .from("email_sequence_enrollments")
      .update({
        status: "stopped",
        next_send_at: null,
        stopped_at: new Date().toISOString(),
        stop_reason: "marketing_consent_false",
      })
      .eq("id", enrollment.id);
    return {
      ok: false,
      code: "NO_CONSENT",
      error:
        "Customer has not consented to marketing email. Enable marketing consent on the customer record first.",
    };
  }

  if (!isResendConfigured()) {
    return {
      ok: false,
      missingConfig: true,
      code: "NOT_CONFIGURED",
      error:
        "Resend is not configured. Set RESEND_API_KEY and EMAIL_FROM in Worker env (see Settings → Integrations).",
    };
  }

  // Dealer-level from-address override (dealerships.settings.email_from),
  // falling back to EMAIL_FROM env inside resolveEmailFrom.
  let emailFrom: string | undefined;
  const { data: dealerRow } = await supabase
    .from("dealerships")
    .select("settings")
    .eq("id", opts.dealershipId)
    .maybeSingle();
  if (dealerRow) {
    emailFrom = resolveEmailFrom(
      (dealerRow.settings as Record<string, unknown>) || null
    ).from;
  }

  const vars: TemplateVars = {
    first_name: opts.recipient.firstName,
    dealership: opts.recipient.dealershipName,
    vehicle_label: opts.recipient.vehicleLabel,
  };

  const subject = renderTemplate(step.subject, vars);
  const bodyHtml = renderTemplate(step.body_html, vars);
  const bodyText = step.body_text
    ? renderTemplate(step.body_text, vars)
    : undefined;

  let listUnsubscribeUrl: string | undefined;
  try {
    listUnsubscribeUrl = await buildUnsubscribeUrl(opts.recipient.toEmail);
  } catch {
    /* footer best-effort */
  }

  const mail = crmEmail({
    subject,
    bodyHtml,
    bodyText,
    dealershipName: vars.dealership || opts.recipient.dealershipName || null,
    unsubscribeUrl: listUnsubscribeUrl,
  });

  const sent = await sendEmail({
    to: opts.recipient.toEmail,
    from: emailFrom,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    listUnsubscribeUrl,
  });

  if (!sent.ok) {
    await supabase.from("email_sequence_sends").insert({
      dealership_id: opts.dealershipId,
      enrollment_id: enrollment.id,
      step_id: step.id,
      step_order: step.step_order,
      to_email: opts.recipient.toEmail,
      status: "failed",
      error: sent.error,
      resend_id: null,
    });
    return {
      ok: false,
      code: sent.missingConfig ? "NOT_CONFIGURED" : "SEND_FAILED",
      missingConfig: sent.missingConfig,
      error: sent.error,
    };
  }

  const { data: sendRow } = await supabase
    .from("email_sequence_sends")
    .insert({
      dealership_id: opts.dealershipId,
      enrollment_id: enrollment.id,
      step_id: step.id,
      step_order: step.step_order,
      to_email: opts.recipient.toEmail,
      status: "sent",
      resend_id: sent.id,
      error: null,
    })
    .select("id")
    .single();

  const { data: following } = await supabase
    .from("email_sequence_steps")
    .select("step_order, delay_days")
    .eq("sequence_id", enrollment.sequence_id)
    .eq("step_order", nextOrder + 1)
    .maybeSingle();

  if (following) {
    await supabase
      .from("email_sequence_enrollments")
      .update({
        current_step: nextOrder,
        next_send_at: addDaysIso(Date.now(), following.delay_days || 0),
      })
      .eq("id", enrollment.id);
  } else {
    await supabase
      .from("email_sequence_enrollments")
      .update({
        current_step: nextOrder,
        status: "completed",
        next_send_at: null,
        stopped_at: new Date().toISOString(),
        stop_reason: "completed",
      })
      .eq("id", enrollment.id);
  }

  return {
    ok: true,
    status: "sent",
    sendId: sendRow?.id,
    resendId: sent.id,
  };
}

export async function resolveRecipientForEnrollment(
  supabase: SupabaseClient,
  enrollment: {
    lead_id: string | null;
    customer_id: string | null;
    dealership_id: string;
  }
): Promise<RecipientContext | { error: string }> {
  let customerId = enrollment.customer_id;
  let vehicleLabel: string | null = null;

  if (enrollment.lead_id) {
    const { data: lead } = await supabase
      .from("leads")
      .select(
        "customer_id, interest_vehicle_id, customer:customers(id, name, email, marketing_consent), vehicle:vehicles(year, make, model)"
      )
      .eq("id", enrollment.lead_id)
      .maybeSingle();

    if (!lead) {
      return { error: "Lead not found" };
    }
    customerId = lead.customer_id || customerId;
    const vehicleRaw = lead.vehicle as unknown;
    const vehicle = (
      Array.isArray(vehicleRaw) ? vehicleRaw[0] : vehicleRaw
    ) as { year: number; make: string; model: string } | null | undefined;
    if (vehicle) {
      vehicleLabel = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
    }

    const customerRaw = lead.customer as unknown;
    const customer = (
      Array.isArray(customerRaw) ? customerRaw[0] : customerRaw
    ) as
      | {
          id: string;
          name: string | null;
          email: string | null;
          marketing_consent: boolean | null;
        }
      | null
      | undefined;

    if (customer) {
      const { data: dealer } = await supabase
        .from("dealerships")
        .select("name")
        .eq("id", enrollment.dealership_id)
        .maybeSingle();

      const firstName =
        (customer.name || "").trim().split(/\s+/)[0] || "there";

      return {
        toEmail: (customer.email || "").trim(),
        firstName,
        dealershipName: dealer?.name || "our dealership",
        vehicleLabel,
        marketingConsent: Boolean(customer.marketing_consent),
      };
    }
  }

  if (!customerId) {
    return { error: "No customer on enrollment" };
  }

  const { data: customer } = await supabase
    .from("customers")
    .select("id, name, email, marketing_consent")
    .eq("id", customerId)
    .maybeSingle();

  if (!customer) {
    return { error: "Customer not found" };
  }

  const { data: dealer } = await supabase
    .from("dealerships")
    .select("name")
    .eq("id", enrollment.dealership_id)
    .maybeSingle();

  const firstName = (customer.name || "").trim().split(/\s+/)[0] || "there";

  return {
    toEmail: (customer.email || "").trim(),
    firstName,
    dealershipName: dealer?.name || "our dealership",
    vehicleLabel,
    marketingConsent: Boolean(customer.marketing_consent),
  };
}
