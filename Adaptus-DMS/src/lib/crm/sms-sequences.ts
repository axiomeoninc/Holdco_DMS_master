/**
 * SMS sequence helpers — stage-triggered follow-up mirroring the Resend
 * email-sequence model. Enforces sms consent + quiet hours on every step and
 * never records a send the provider didn't confirm.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { isTwilioConfigured } from "@/src/lib/sms/config";
import { sendSmsMessage } from "@/src/lib/sms/provider";

export type SmsSequenceStepInput = {
  step_order: number;
  delay_days: number;
  body_text: string;
};

export const DEFAULT_SMS_NURTURE_NAME = "SMS follow-up (2-step)";

export const DEFAULT_SMS_NURTURE_STEPS: SmsSequenceStepInput[] = [
  {
    step_order: 1,
    delay_days: 0,
    body_text:
      "Hi {{first_name}}, thanks for contacting {{dealership}}{{vehicle_clause}}. Reply STOP anytime to opt out of texts.",
  },
  {
    step_order: 2,
    delay_days: 2,
    body_text:
      "Hi {{first_name}}, just checking in from {{dealership}}{{vehicle_clause}}. Reply STOP anytime to opt out.",
  },
];

export type SmsTemplateVars = {
  first_name: string;
  dealership: string;
  vehicle_label: string | null;
};

export function renderSmsTemplate(
  template: string,
  vars: SmsTemplateVars
): string {
  const vehicleClause = vars.vehicle_label ? ` about the ${vars.vehicle_label}` : "";
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

export type EnsureSmsSequenceResult =
  | { ok: true; sequenceId: string; created: boolean }
  | { ok: false; error: string };

/** Ensure the dealership has the default 2-step SMS follow-up sequence. */
export async function ensureDefaultSmsSequence(
  supabase: SupabaseClient,
  opts: { dealershipId: string; userId: string }
): Promise<EnsureSmsSequenceResult> {
  const { data: existing, error: findErr } = await supabase
    .from("sms_sequences")
    .select("id")
    .eq("dealership_id", opts.dealershipId)
    .eq("name", DEFAULT_SMS_NURTURE_NAME)
    .maybeSingle();

  if (findErr) return { ok: false, error: findErr.message };
  if (existing?.id) return { ok: true, sequenceId: existing.id, created: false };

  const { data: created, error: createErr } = await supabase
    .from("sms_sequences")
    .insert({
      dealership_id: opts.dealershipId,
      name: DEFAULT_SMS_NURTURE_NAME,
      description:
        "Default SMS follow-up: same-day thank-you, day-2 check-in. Consent + quiet hours enforced.",
      is_active: true,
      created_by: opts.userId,
    })
    .select("id")
    .single();

  if (createErr || !created) {
    return { ok: false, error: createErr?.message || "Failed to create sequence" };
  }

  const steps = DEFAULT_SMS_NURTURE_STEPS.map((s) => ({
    sequence_id: created.id,
    step_order: s.step_order,
    delay_days: s.delay_days,
    body_text: s.body_text,
  }));

  const { error: stepsErr } = await supabase
    .from("sms_sequence_steps")
    .insert(steps);

  if (stepsErr) return { ok: false, error: stepsErr.message };

  return { ok: true, sequenceId: created.id, created: true };
}

export type SmsRecipientContext = {
  toPhone: string;
  firstName: string;
  dealershipName: string;
  vehicleLabel: string | null;
  smsConsent: boolean;
  customerId: string | null;
};

export type SendNextSmsResult =
  | { ok: true; status: "sent" | "skipped" | "completed"; sendId?: string; providerSid?: string | null; message?: string }
  | {
      ok: false;
      error: string;
      missingConfig?: boolean;
      code?:
        | "NOT_CONFIGURED"
        | "NO_PHONE"
        | "NO_CONSENT"
        | "QUIET_HOURS"
        | "STOPPED"
        | "NO_STEP"
        | "SEND_FAILED";
    };

/** Resolve the phone + consent context for an enrollment (lead → customer). */
export async function resolveRecipientForSmsEnrollment(
  supabase: SupabaseClient,
  enrollment: { lead_id: string | null; customer_id: string | null; dealership_id: string }
): Promise<SmsRecipientContext | { error: string }> {
  let customerId = enrollment.customer_id;
  let vehicleLabel: string | null = null;

  if (enrollment.lead_id) {
    const { data: lead } = await supabase
      .from("leads")
      .select(
        "customer_id, interest_vehicle_id, customer:customers(id, name, phone, sms_consent), vehicle:vehicles(year, make, model)"
      )
      .eq("id", enrollment.lead_id)
      .maybeSingle();

    if (!lead) return { error: "Lead not found" };
    customerId = lead.customer_id || customerId;

    const vehicleRaw = lead.vehicle as unknown;
    const vehicle = (
      Array.isArray(vehicleRaw) ? vehicleRaw[0] : vehicleRaw
    ) as { year: number; make: string; model: string } | null | undefined;
    if (vehicle) vehicleLabel = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;

    const customerRaw = lead.customer as unknown;
    const customer = (
      Array.isArray(customerRaw) ? customerRaw[0] : customerRaw
    ) as
      | { id: string; name: string | null; phone: string | null; sms_consent: boolean | null }
      | null
      | undefined;

    if (customer) {
      const { data: dealer } = await supabase
        .from("dealerships")
        .select("name")
        .eq("id", enrollment.dealership_id)
        .maybeSingle();
      const firstName = (customer.name || "").trim().split(/\s+/)[0] || "there";
      return {
        toPhone: (customer.phone || "").trim(),
        firstName,
        dealershipName: dealer?.name || "our dealership",
        vehicleLabel,
        smsConsent: Boolean(customer.sms_consent),
        customerId: customer.id,
      };
    }
  }

  if (!customerId) return { error: "No customer on enrollment" };

  const { data: customer } = await supabase
    .from("customers")
    .select("id, name, phone, sms_consent")
    .eq("id", customerId)
    .maybeSingle();

  if (!customer) return { error: "Customer not found" };

  const { data: dealer } = await supabase
    .from("dealerships")
    .select("name")
    .eq("id", enrollment.dealership_id)
    .maybeSingle();

  const firstName = (customer.name || "").trim().split(/\s+/)[0] || "there";

  return {
    toPhone: (customer.phone || "").trim(),
    firstName,
    dealershipName: dealer?.name || "our dealership",
    vehicleLabel,
    smsConsent: Boolean(customer.sms_consent),
    customerId: customer.id,
  };
}

/**
 * Send the next pending SMS step for an active enrollment.
 * Enforces consent + quiet hours; quiet-hours blocks are logged as skipped
 * and the step is rescheduled (+1 day). Provider failure is recorded as
 * failed — never a fake sent.
 */
export async function sendNextSmsSequenceStep(
  supabase: SupabaseClient,
  opts: {
    enrollmentId: string;
    dealershipId: string;
    recipient: SmsRecipientContext;
    force?: boolean;
  }
): Promise<SendNextSmsResult> {
  const { data: enrollment, error: enrErr } = await supabase
    .from("sms_sequence_enrollments")
    .select("*")
    .eq("id", opts.enrollmentId)
    .eq("dealership_id", opts.dealershipId)
    .maybeSingle();

  if (enrErr || !enrollment) {
    return { ok: false, error: enrErr?.message || "Enrollment not found" };
  }

  if (enrollment.status !== "active") {
    return { ok: false, code: "STOPPED", error: `Enrollment is ${enrollment.status}` };
  }

  if (!opts.force && enrollment.next_send_at) {
    const due = new Date(enrollment.next_send_at).getTime();
    if (Number.isFinite(due) && due > Date.now()) {
      return {
        ok: true,
        status: "skipped",
        message: `Next step scheduled for ${enrollment.next_send_at}.`,
      };
    }
  }

  const nextOrder = (enrollment.current_step || 0) + 1;

  const { data: step, error: stepErr } = await supabase
    .from("sms_sequence_steps")
    .select("*")
    .eq("sequence_id", enrollment.sequence_id)
    .eq("step_order", nextOrder)
    .maybeSingle();

  if (stepErr) return { ok: false, error: stepErr.message };

  if (!step) {
    await supabase
      .from("sms_sequence_enrollments")
      .update({
        status: "completed",
        next_send_at: null,
        stopped_at: new Date().toISOString(),
        stop_reason: "completed",
      })
      .eq("id", enrollment.id);
    return { ok: true, status: "completed", message: "Sequence already complete" };
  }

  if (!opts.recipient.toPhone) {
    await supabase.from("sms_sequence_sends").insert({
      dealership_id: opts.dealershipId,
      enrollment_id: enrollment.id,
      step_id: step.id,
      step_order: step.step_order,
      to_phone: "",
      status: "skipped",
      error: "No recipient phone",
    });
    await supabase
      .from("sms_sequence_enrollments")
      .update({
        status: "stopped",
        next_send_at: null,
        stopped_at: new Date().toISOString(),
        stop_reason: "no_phone",
      })
      .eq("id", enrollment.id);
    return { ok: false, code: "NO_PHONE", error: "Customer has no phone number" };
  }

  if (!opts.recipient.smsConsent) {
    await supabase.from("sms_sequence_sends").insert({
      dealership_id: opts.dealershipId,
      enrollment_id: enrollment.id,
      step_id: step.id,
      step_order: step.step_order,
      to_phone: opts.recipient.toPhone,
      status: "skipped",
      error: "sms_consent=false",
    });
    await supabase
      .from("sms_sequence_enrollments")
      .update({
        status: "stopped",
        next_send_at: null,
        stopped_at: new Date().toISOString(),
        stop_reason: "sms_consent_false",
      })
      .eq("id", enrollment.id);
    return {
      ok: false,
      code: "NO_CONSENT",
      error: "Customer has not consented to SMS. Enable SMS consent first.",
    };
  }

  if (!isTwilioConfigured()) {
    return {
      ok: false,
      missingConfig: true,
      code: "NOT_CONFIGURED",
      error:
        "SMS provider is not configured. Set TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM_NUMBER in Worker env.",
    };
  }

  const vars: SmsTemplateVars = {
    first_name: opts.recipient.firstName,
    dealership: opts.recipient.dealershipName,
    vehicle_label: opts.recipient.vehicleLabel,
  };
  const body = renderSmsTemplate(step.body_text, vars);

  const sent = await sendSmsMessage(supabase, {
    dealershipId: opts.dealershipId,
    customer: {
      id: opts.recipient.customerId,
      phone: opts.recipient.toPhone,
      sms_consent: true,
    },
    body,
    marketing: true,
    recordBlocked: true,
    source: "sms-sequence",
  });

  if (!sent.ok) {
    if (sent.code === "QUIET_HOURS") {
      // Honest: blocked by quiet hours — log skipped and retry tomorrow.
      await supabase.from("sms_sequence_sends").insert({
        dealership_id: opts.dealershipId,
        enrollment_id: enrollment.id,
        step_id: step.id,
        step_order: step.step_order,
        to_phone: opts.recipient.toPhone,
        status: "skipped",
        error: "quiet hours",
        sms_message_id: sent.smsMessageId ?? null,
      });
      await supabase
        .from("sms_sequence_enrollments")
        .update({
          current_step: nextOrder - 1,
          next_send_at: addDaysIso(Date.now(), 1),
        })
        .eq("id", enrollment.id);
      return {
        ok: false,
        code: "QUIET_HOURS",
        error: sent.error,
      };
    }

    await supabase.from("sms_sequence_sends").insert({
      dealership_id: opts.dealershipId,
      enrollment_id: enrollment.id,
      step_id: step.id,
      step_order: step.step_order,
      to_phone: opts.recipient.toPhone,
      status: "failed",
      error: sent.error,
      sms_message_id: sent.smsMessageId ?? null,
    });
    return {
      ok: false,
      code: sent.code === "NOT_CONFIGURED" ? "NOT_CONFIGURED" : "SEND_FAILED",
      missingConfig: sent.code === "NOT_CONFIGURED",
      error: sent.error,
    };
  }

  const { data: sendRow } = await supabase
    .from("sms_sequence_sends")
    .insert({
      dealership_id: opts.dealershipId,
      enrollment_id: enrollment.id,
      step_id: step.id,
      step_order: step.step_order,
      to_phone: opts.recipient.toPhone,
      status: "sent",
      sms_message_id: sent.smsMessageId ?? null,
      provider_sid: sent.providerSid ?? null,
      error: null,
    })
    .select("id")
    .single();

  const { data: following } = await supabase
    .from("sms_sequence_steps")
    .select("step_order, delay_days")
    .eq("sequence_id", enrollment.sequence_id)
    .eq("step_order", nextOrder + 1)
    .maybeSingle();

  if (following) {
    await supabase
      .from("sms_sequence_enrollments")
      .update({
        current_step: nextOrder,
        next_send_at: addDaysIso(Date.now(), following.delay_days || 0),
      })
      .eq("id", enrollment.id);
  } else {
    await supabase
      .from("sms_sequence_enrollments")
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
    providerSid: sent.providerSid,
  };
}
