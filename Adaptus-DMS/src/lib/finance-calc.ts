/**
 * Shared F&I payment worksheet math (Ontario-style tax + admin fee).
 */

export type PaymentType = "monthly" | "biweekly" | "weekly";

export type FinanceCalcInput = {
    sale_price: number;
    down_payment: number;
    trade_in_value: number;
    interest_rate: number;
    term_months: number;
    tax_rate: number;
    admin_fee: number;
    payment_type: PaymentType;
};

export type FinanceCalcResult = {
    payment_amount: number;
    total_interest: number;
    total_cost: number;
    tax_amount: number;
    financed_amount: number;
};

export function computePayment(form: FinanceCalcInput): FinanceCalcResult {
    const taxAmount = form.sale_price * (form.tax_rate / 100);
    const financedAmount = Math.max(
        0,
        form.sale_price + taxAmount + form.admin_fee - form.trade_in_value - form.down_payment
    );
    const periodsPerYear =
        form.payment_type === "monthly" ? 12 : form.payment_type === "biweekly" ? 26 : 52;
    const numPeriods =
        form.payment_type === "monthly"
            ? form.term_months
            : (form.term_months * periodsPerYear) / 12;
    const periodicRate = form.interest_rate / 100 / periodsPerYear;

    let paymentAmount = 0;
    let totalInterest = 0;

    if (financedAmount > 0 && numPeriods > 0) {
        if (form.interest_rate > 0) {
            const factor = Math.pow(1 + periodicRate, numPeriods);
            paymentAmount = (financedAmount * (periodicRate * factor)) / (factor - 1);
            totalInterest = paymentAmount * numPeriods - financedAmount;
        } else {
            paymentAmount = financedAmount / numPeriods;
        }
    }

    return {
        payment_amount: paymentAmount,
        total_interest: totalInterest,
        total_cost: financedAmount + totalInterest,
        tax_amount: taxAmount,
        financed_amount: financedAmount,
    };
}

export function formatCad(value: number): string {
    return new Intl.NumberFormat("en-CA", {
        style: "currency",
        currency: "CAD",
    }).format(value || 0);
}

/** Build a printable plain-text worksheet for clipboard / print window. */
export function buildPaymentWorksheetText(opts: {
    dealerName?: string;
    vehicleLabel?: string;
    customerName?: string;
    form: FinanceCalcInput;
    result: FinanceCalcResult;
}): string {
    const freq =
        opts.form.payment_type === "monthly"
            ? "Monthly"
            : opts.form.payment_type === "biweekly"
              ? "Bi-weekly"
              : "Weekly";
    const lines = [
        "F&I Payment Worksheet — AdaptUs DMS",
        opts.dealerName ? `Dealer: ${opts.dealerName}` : null,
        opts.vehicleLabel ? `Vehicle: ${opts.vehicleLabel}` : null,
        opts.customerName ? `Customer: ${opts.customerName}` : null,
        `Date: ${new Date().toLocaleString("en-CA")}`,
        "",
        `Sale price:     ${formatCad(opts.form.sale_price)}`,
        `Tax (${opts.form.tax_rate}%):   ${formatCad(opts.result.tax_amount)}`,
        `Admin fee:      ${formatCad(opts.form.admin_fee)}`,
        `Trade-in:       ${formatCad(opts.form.trade_in_value)}`,
        `Down payment:   ${formatCad(opts.form.down_payment)}`,
        `Financed:       ${formatCad(opts.result.financed_amount)}`,
        `Rate:           ${opts.form.interest_rate}%`,
        `Term:           ${opts.form.term_months} months`,
        `Frequency:      ${freq}`,
        "",
        `${freq} payment: ${formatCad(opts.result.payment_amount)}`,
        `Total interest: ${formatCad(opts.result.total_interest)}`,
        `Total cost:     ${formatCad(opts.result.total_cost)}`,
        "",
        "Estimate only — subject to lender approval and Ontario disclosure.",
    ];
    return lines.filter((l) => l !== null).join("\n");
}
