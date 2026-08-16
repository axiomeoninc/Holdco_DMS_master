-- Ontario Bill of Sale columns + payments table
-- Idempotent: ADD COLUMN IF NOT EXISTS only. Safe for Nova floors (158/77/71).
-- Applied via Supabase Management API database/query endpoint.

-- ============================================================================
-- bill_of_sale: Ontario BOS UI columns (BillOfSaleModal.tsx)
-- ============================================================================

ALTER TABLE public.bill_of_sale ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL;
ALTER TABLE public.bill_of_sale ADD COLUMN IF NOT EXISTS vehicle_description TEXT;
ALTER TABLE public.bill_of_sale ADD COLUMN IF NOT EXISTS sale_type TEXT;

-- Section B: Pricing
ALTER TABLE public.bill_of_sale ADD COLUMN IF NOT EXISTS price_vehicle NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.bill_of_sale ADD COLUMN IF NOT EXISTS additional_equipment NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.bill_of_sale ADD COLUMN IF NOT EXISTS services_warranties NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.bill_of_sale ADD COLUMN IF NOT EXISTS documentation_fees NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.bill_of_sale ADD COLUMN IF NOT EXISTS vsa_levy_recovery NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.bill_of_sale ADD COLUMN IF NOT EXISTS extra_fee_1_taxable NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.bill_of_sale ADD COLUMN IF NOT EXISTS discount NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.bill_of_sale ADD COLUMN IF NOT EXISTS subtotal NUMERIC(12,2) DEFAULT 0;

-- Trade-in summary
ALTER TABLE public.bill_of_sale ADD COLUMN IF NOT EXISTS trade_in_allowance NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.bill_of_sale ADD COLUMN IF NOT EXISTS net_difference NUMERIC(12,2) DEFAULT 0;

-- GST/PST
ALTER TABLE public.bill_of_sale ADD COLUMN IF NOT EXISTS gst_rate NUMERIC(5,2) DEFAULT 5.00;
ALTER TABLE public.bill_of_sale ADD COLUMN IF NOT EXISTS gst_amount NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.bill_of_sale ADD COLUMN IF NOT EXISTS pst_rate NUMERIC(5,2) DEFAULT 7.00;
ALTER TABLE public.bill_of_sale ADD COLUMN IF NOT EXISTS pst_amount NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.bill_of_sale ADD COLUMN IF NOT EXISTS purchase_price_with_gst_pst NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.bill_of_sale ADD COLUMN IF NOT EXISTS gst_enabled BOOLEAN DEFAULT true;
ALTER TABLE public.bill_of_sale ADD COLUMN IF NOT EXISTS pst_enabled BOOLEAN DEFAULT true;

-- Section C: Additional fees
ALTER TABLE public.bill_of_sale ADD COLUMN IF NOT EXISTS licence_fee NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.bill_of_sale ADD COLUMN IF NOT EXISTS gasoline_fee NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.bill_of_sale ADD COLUMN IF NOT EXISTS finance_fee NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.bill_of_sale ADD COLUMN IF NOT EXISTS lien_payout NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.bill_of_sale ADD COLUMN IF NOT EXISTS extra_fee_2_non_taxable NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.bill_of_sale ADD COLUMN IF NOT EXISTS sub_total NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.bill_of_sale ADD COLUMN IF NOT EXISTS deposit NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.bill_of_sale ADD COLUMN IF NOT EXISTS down_payments NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.bill_of_sale ADD COLUMN IF NOT EXISTS down_payment NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.bill_of_sale ADD COLUMN IF NOT EXISTS insurance_life NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.bill_of_sale ADD COLUMN IF NOT EXISTS insurance_gap NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.bill_of_sale ADD COLUMN IF NOT EXISTS rst_on_insurance NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.bill_of_sale ADD COLUMN IF NOT EXISTS total_purchase_price NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.bill_of_sale ADD COLUMN IF NOT EXISTS ppsa_fee NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.bill_of_sale ADD COLUMN IF NOT EXISTS admin_fee NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.bill_of_sale ADD COLUMN IF NOT EXISTS amount_to_finance NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.bill_of_sale ADD COLUMN IF NOT EXISTS total_balance_due NUMERIC(12,2) DEFAULT 0;

-- Section D: Financing
ALTER TABLE public.bill_of_sale ADD COLUMN IF NOT EXISTS payment_type TEXT;
ALTER TABLE public.bill_of_sale ADD COLUMN IF NOT EXISTS cost_of_borrowing NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.bill_of_sale ADD COLUMN IF NOT EXISTS payment_start_date DATE;
ALTER TABLE public.bill_of_sale ADD COLUMN IF NOT EXISTS finance_amount NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.bill_of_sale ADD COLUMN IF NOT EXISTS finance_term INTEGER;
ALTER TABLE public.bill_of_sale ADD COLUMN IF NOT EXISTS interest_rate NUMERIC(5,2);
ALTER TABLE public.bill_of_sale ADD COLUMN IF NOT EXISTS finance_company TEXT;
ALTER TABLE public.bill_of_sale ADD COLUMN IF NOT EXISTS payment_frequency TEXT;
ALTER TABLE public.bill_of_sale ADD COLUMN IF NOT EXISTS number_of_payments INTEGER;

-- Section E: Trade-in vehicle details
ALTER TABLE public.bill_of_sale ADD COLUMN IF NOT EXISTS trade_in_year INTEGER;
ALTER TABLE public.bill_of_sale ADD COLUMN IF NOT EXISTS trade_in_make TEXT;
ALTER TABLE public.bill_of_sale ADD COLUMN IF NOT EXISTS trade_in_model TEXT;
ALTER TABLE public.bill_of_sale ADD COLUMN IF NOT EXISTS trade_in_series TEXT;
ALTER TABLE public.bill_of_sale ADD COLUMN IF NOT EXISTS trade_in_cylinders INTEGER;
ALTER TABLE public.bill_of_sale ADD COLUMN IF NOT EXISTS trade_in_odometer INTEGER;
ALTER TABLE public.bill_of_sale ADD COLUMN IF NOT EXISTS trade_in_kms_miles TEXT DEFAULT 'KMS';
ALTER TABLE public.bill_of_sale ADD COLUMN IF NOT EXISTS trade_in_exterior_color TEXT;
ALTER TABLE public.bill_of_sale ADD COLUMN IF NOT EXISTS trade_in_interior_color TEXT;
ALTER TABLE public.bill_of_sale ADD COLUMN IF NOT EXISTS trade_in_vin TEXT;
ALTER TABLE public.bill_of_sale ADD COLUMN IF NOT EXISTS trade_in_stock_number TEXT;
ALTER TABLE public.bill_of_sale ADD COLUMN IF NOT EXISTS trade_in_owing_to TEXT;
ALTER TABLE public.bill_of_sale ADD COLUMN IF NOT EXISTS trade_in_odometer_delivery INTEGER DEFAULT 0;
ALTER TABLE public.bill_of_sale ADD COLUMN IF NOT EXISTS trade_in_disclosure TEXT;

-- Buyer / warranty helpers
ALTER TABLE public.bill_of_sale ADD COLUMN IF NOT EXISTS buyer_phone TEXT;
ALTER TABLE public.bill_of_sale ADD COLUMN IF NOT EXISTS buyer_email TEXT;
ALTER TABLE public.bill_of_sale ADD COLUMN IF NOT EXISTS buyer_dl_number TEXT;
ALTER TABLE public.bill_of_sale ADD COLUMN IF NOT EXISTS odometer_reading INTEGER;
ALTER TABLE public.bill_of_sale ADD COLUMN IF NOT EXISTS warranty_period TEXT;

-- Section F/G: Notes & status
ALTER TABLE public.bill_of_sale ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.bill_of_sale ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'Not Paid';
ALTER TABLE public.bill_of_sale ADD COLUMN IF NOT EXISTS is_new_version BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_bill_of_sale_customer_id ON public.bill_of_sale(customer_id);
CREATE INDEX IF NOT EXISTS idx_bill_of_sale_deal_id ON public.bill_of_sale(deal_id);

-- Allow status 'Sold' (modal mark-as-sold path)
ALTER TABLE public.bill_of_sale DROP CONSTRAINT IF EXISTS bill_of_sale_status_check;
ALTER TABLE public.bill_of_sale ADD CONSTRAINT bill_of_sale_status_check
    CHECK (status IN ('Draft', 'Signed', 'Completed', 'Cancelled', 'Sold'));

-- ============================================================================
-- bill_of_sale_payments
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.bill_of_sale_payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    bill_of_sale_id UUID NOT NULL REFERENCES public.bill_of_sale(id) ON DELETE CASCADE,
    payment_name TEXT NOT NULL DEFAULT '',
    payment_type TEXT NOT NULL DEFAULT '',
    amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    payment_date DATE DEFAULT CURRENT_DATE,
    dealership_id UUID REFERENCES public.dealerships(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bill_of_sale_payments_bill_id ON public.bill_of_sale_payments(bill_of_sale_id);
CREATE INDEX IF NOT EXISTS idx_bill_of_sale_payments_dealership_id ON public.bill_of_sale_payments(dealership_id);

ALTER TABLE public.bill_of_sale_payments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'bill_of_sale_payments_select_policy' AND polrelid = 'public.bill_of_sale_payments'::regclass) THEN
        CREATE POLICY bill_of_sale_payments_select_policy ON public.bill_of_sale_payments
            FOR SELECT USING (dealership_id = get_user_dealership_id() OR is_platform_admin() = true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'bill_of_sale_payments_insert_policy' AND polrelid = 'public.bill_of_sale_payments'::regclass) THEN
        CREATE POLICY bill_of_sale_payments_insert_policy ON public.bill_of_sale_payments
            FOR INSERT WITH CHECK (dealership_id = get_user_dealership_id() OR is_platform_admin() = true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'bill_of_sale_payments_update_policy' AND polrelid = 'public.bill_of_sale_payments'::regclass) THEN
        CREATE POLICY bill_of_sale_payments_update_policy ON public.bill_of_sale_payments
            FOR UPDATE USING (dealership_id = get_user_dealership_id() OR is_platform_admin() = true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'bill_of_sale_payments_delete_policy' AND polrelid = 'public.bill_of_sale_payments'::regclass) THEN
        CREATE POLICY bill_of_sale_payments_delete_policy ON public.bill_of_sale_payments
            FOR DELETE USING (dealership_id = get_user_dealership_id() OR is_platform_admin() = true);
    END IF;
END $$;

-- ============================================================================
-- Sibling schema drifts (same class of PostgREST cache errors)
-- ============================================================================

ALTER TABLE public.test_drives ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_test_drives_lead_id ON public.test_drives(lead_id);

ALTER TABLE public.sales_deals ADD COLUMN IF NOT EXISTS finance_term INTEGER;
ALTER TABLE public.sales_deals ADD COLUMN IF NOT EXISTS interest_rate NUMERIC(5,2);
ALTER TABLE public.sales_deals ADD COLUMN IF NOT EXISTS finance_company TEXT;
ALTER TABLE public.sales_deals ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE public.sales_deals DROP CONSTRAINT IF EXISTS sales_deals_deal_status_check;
ALTER TABLE public.sales_deals ADD CONSTRAINT sales_deals_deal_status_check
    CHECK (deal_status IN ('Open', 'Negotiation', 'Down Payment', 'Finance', 'Pending', 'Paid Off', 'Closed', 'Lost', 'Cancelled'));

NOTIFY pgrst, 'reload schema';
