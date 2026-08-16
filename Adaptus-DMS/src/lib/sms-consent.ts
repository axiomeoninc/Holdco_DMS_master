/**
 * CASL SMS consent gate — call before any SMS-like send.
 */

export type SmsConsentCustomer = {
    id?: string | null;
    sms_consent?: boolean | null;
    phone?: string | null;
};

export class SmsConsentError extends Error {
    readonly code = "SMS_CONSENT_REQUIRED" as const;
    constructor(message = "Cannot send SMS: customer has not consented to SMS (CASL).") {
        super(message);
        this.name = "SmsConsentError";
    }
}

export function assertSmsConsent(customer: SmsConsentCustomer | null | undefined): void {
    if (!customer) {
        throw new SmsConsentError("Cannot send SMS: customer not found.");
    }
    if (!customer.sms_consent) {
        throw new SmsConsentError();
    }
    if (!customer.phone?.trim()) {
        throw new SmsConsentError("Cannot send SMS: customer has no phone number.");
    }
}

export function canSendSms(customer: SmsConsentCustomer | null | undefined): boolean {
    try {
        assertSmsConsent(customer);
        return true;
    } catch {
        return false;
    }
}
