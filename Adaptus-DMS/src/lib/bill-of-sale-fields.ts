/** Persisted bill_of_sale columns (Ontario BOS UI + legacy required fields). */
export const BILL_OF_SALE_ALLOWED_FIELDS = [
    // Legacy required / document fields
    "deal_id",
    "vehicle_id",
    "customer_id",
    "document_number",
    "sale_date",
    "buyer_name",
    "buyer_address",
    "buyer_phone",
    "buyer_email",
    "buyer_dl_number",
    "seller_name",
    "vin",
    "year",
    "make",
    "model",
    "sale_price",
    "tax_amount",
    "total_amount",
    "odometer",
    "odometer_reading",
    "is_financed",
    "lender_name",
    "lender_address",
    "status",
    "payment_status",
    "warranty_period",

    // Ontario BOS — vehicle & sale type
    "vehicle_description",
    "sale_type",

    // Section B: Pricing
    "price_vehicle",
    "additional_equipment",
    "services_warranties",
    "documentation_fees",
    "vsa_levy_recovery",
    "extra_fee_1_taxable",
    "discount",
    "subtotal",

    // Trade-in summary
    "trade_in_allowance",
    "net_difference",

    // GST/PST
    "gst_rate",
    "gst_amount",
    "pst_rate",
    "pst_amount",
    "purchase_price_with_gst_pst",
    "gst_enabled",
    "pst_enabled",

    // Section C: Additional fees
    "licence_fee",
    "gasoline_fee",
    "finance_fee",
    "lien_payout",
    "extra_fee_2_non_taxable",
    "sub_total",
    "deposit",
    "down_payments",
    "down_payment",
    "insurance_life",
    "insurance_gap",
    "rst_on_insurance",
    "total_purchase_price",
    "ppsa_fee",
    "admin_fee",
    "amount_to_finance",
    "total_balance_due",

    // Section D: Financing
    "payment_type",
    "cost_of_borrowing",
    "payment_start_date",
    "finance_amount",
    "finance_term",
    "interest_rate",
    "finance_company",
    "payment_frequency",
    "number_of_payments",

    // Section E: Trade-in vehicle
    "trade_in_year",
    "trade_in_make",
    "trade_in_model",
    "trade_in_series",
    "trade_in_cylinders",
    "trade_in_odometer",
    "trade_in_kms_miles",
    "trade_in_exterior_color",
    "trade_in_interior_color",
    "trade_in_vin",
    "trade_in_stock_number",
    "trade_in_owing_to",
    "trade_in_odometer_delivery",
    "trade_in_disclosure",

    // Notes & flags
    "notes",
    "is_new_version",
] as const;

export type BillOfSaleAllowedField = (typeof BILL_OF_SALE_ALLOWED_FIELDS)[number];

/** Map Ontario UI payload to legacy NOT NULL columns before insert/update. */
export function mapBillOfSaleLegacyFields(
    payload: Record<string, unknown>,
    customerName?: string | null
): Record<string, unknown> {
    const out = { ...payload };

    if (out.sale_price == null && out.price_vehicle != null) {
        out.sale_price = out.price_vehicle;
    }
    if (out.total_amount == null) {
        out.total_amount =
            out.total_balance_due ?? out.total_purchase_price ?? out.sale_price ?? 0;
    }
    if (!out.buyer_name && customerName) {
        out.buyer_name = customerName;
    }
    if (out.buyer_name == null || out.buyer_name === "") {
        out.buyer_name = "Unknown Buyer";
    }
    if (out.tax_amount == null) {
        const gst = Number(out.gst_amount) || 0;
        const pst = Number(out.pst_amount) || 0;
        out.tax_amount = gst + pst;
    }

    return out;
}
