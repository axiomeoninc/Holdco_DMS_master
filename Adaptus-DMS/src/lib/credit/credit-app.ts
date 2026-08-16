/**
 * Credit application capture + partner-led screening (stub).
 *
 * Explicitly NOT a lender network. We store the application, compute a
 * screening-ready summary, and only ever mark "submitted to partner" when a
 * partner channel is configured for the dealership. Nothing is forwarded
 * anywhere automatically.
 *
 * Pure helper — no I/O. Safe for client + unit tests.
 */

export interface CreditApplicationInput {
    first_name?: string | null;
    last_name?: string | null;
    date_of_birth?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    city?: string | null;
    province?: string | null;
    postal_code?: string | null;
    employer?: string | null;
    employment_years?: number | string | null;
    annual_income?: number | string | null;
    monthly_rent?: number | string | null;
    desired_vehicle_id?: string | null;
    requested_amount?: number | string | null;
    trade_in_value?: number | string | null;
    trade_in_payoff?: number | string | null;
    coapplicant_first_name?: string | null;
    coapplicant_last_name?: string | null;
    coapplicant_annual_income?: number | string | null;
    coapplicant_employer?: string | null;
    notes?: string | null;
}

export const CREDIT_REQUIRED_FIELDS: Array<keyof CreditApplicationInput> = [
    "first_name",
    "last_name",
    "email",
    "phone",
    "annual_income",
    "employer",
];

export function num(value: number | string | null | undefined): number | null {
    if (value === null || value === undefined || value === "") return null;
    const n = typeof value === "number" ? value : parseFloat(value);
    return Number.isFinite(n) ? n : null;
}

export interface ScreeningSummary {
    ready: boolean;
    missing_fields: Array<keyof CreditApplicationInput>;
    annual_income: number | null;
    monthly_income: number | null;
    employment_years: number | null;
    trade_equity: number | null;
    requested_amount: number | null;
    affordability_band: string | null;
    risk_flags: string[];
}

/**
 * Compute a screening-ready summary. Pure math — no partner decisions.
 * Risk flags are advisory only (income, employment stability, trade equity).
 */
export function computeScreeningSummary(
    input: CreditApplicationInput
): ScreeningSummary {
    const missing_fields = CREDIT_REQUIRED_FIELDS.filter(
        (f) => !input[f] || String(input[f]).trim() === ""
    );

    const annualIncome = num(input.annual_income);
    const monthlyIncome = annualIncome !== null ? annualIncome / 12 : null;
    const employmentYears = num(input.employment_years);
    const tradeValue = num(input.trade_in_value);
    const tradePayoff = num(input.trade_in_payoff);
    const tradeEquity =
        tradeValue !== null && tradePayoff !== null
            ? tradeValue - tradePayoff
            : tradeValue !== null
              ? tradeValue
              : null;
    const requestedAmount = num(input.requested_amount);

    const risk_flags: string[] = [];
    if (annualIncome !== null && annualIncome < 20000) {
        risk_flags.push("Low declared annual income");
    }
    if (employmentYears !== null && employmentYears < 1) {
        risk_flags.push("Less than 1 year with current employer");
    }
    if (tradeEquity !== null && tradeEquity < 0) {
        risk_flags.push("Negative trade-in equity");
    }
    if (requestedAmount !== null && monthlyIncome !== null) {
        const ratio =
            monthlyIncome > 0 ? requestedAmount / (monthlyIncome * 4) : null;
        if (ratio !== null && ratio > 1.5) {
            risk_flags.push("Requested amount high vs estimated payment capacity");
        }
    }

    // Advisory affordability band (desk math only — not approval).
    let affordability_band: string | null = null;
    if (monthlyIncome !== null) {
        const budget = Math.round(monthlyIncome * 0.15);
        if (budget <= 350) affordability_band = "$0–$12,000";
        else if (budget <= 550) affordability_band = "$12,000–$25,000";
        else if (budget <= 800) affordability_band = "$25,000–$40,000";
        else affordability_band = "$40,000+";
    }

    return {
        ready: missing_fields.length === 0,
        missing_fields,
        annual_income: annualIncome,
        monthly_income: monthlyIncome,
        employment_years: employmentYears,
        trade_equity: tradeEquity,
        requested_amount: requestedAmount,
        affordability_band,
        risk_flags,
    };
}

export function applicantFullName(input: CreditApplicationInput): string {
    return [input.first_name, input.last_name].filter(Boolean).join(" ") || "Unnamed";
}
