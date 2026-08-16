-- Tier 3: Auction / wholesale sourcing
-- Idempotent: ADD COLUMN IF NOT EXISTS only.
-- Applied via Supabase Management API database/query endpoint (see existing migrations).
-- Honest: auction lot capture is informational record-keeping. NO market-data
-- claims are made without a configured data source; no auto-bidding exists.

-- ============================================================================
-- AUCTION LOT CAPTURE ON PURCHASES
-- ============================================================================

-- Where/how a vehicle was sourced at auction/wholesale. All columns nullable
-- so "Purchase from Public" flow remains unchanged.
ALTER TABLE public.purchase_from_public ADD COLUMN IF NOT EXISTS source_kind TEXT CHECK (source_kind IN ('public', 'auction', 'wholesale', 'trade', 'other'));
ALTER TABLE public.purchase_from_public ADD COLUMN IF NOT EXISTS auction_venue TEXT;
ALTER TABLE public.purchase_from_public ADD COLUMN IF NOT EXISTS auction_lot_number TEXT;
ALTER TABLE public.purchase_from_public ADD COLUMN IF NOT EXISTS auction_sale_date DATE;
ALTER TABLE public.purchase_from_public ADD COLUMN IF NOT EXISTS comp_notes TEXT;

-- Mirror the sourcing info onto the vehicle record (advisory copy) so
-- inventory views can show provenance without a join.
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS source_kind TEXT CHECK (source_kind IN ('public', 'auction', 'wholesale', 'trade', 'other'));
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS auction_venue TEXT;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS auction_lot_number TEXT;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS auction_sale_date DATE;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS comp_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_purchases_source_kind ON public.purchase_from_public(source_kind);
CREATE INDEX IF NOT EXISTS idx_purchases_auction_lot ON public.purchase_from_public(auction_venue, auction_lot_number);
CREATE INDEX IF NOT EXISTS idx_vehicles_source_kind ON public.vehicles(source_kind);

-- No new tables, no new policies required (columns extend existing tables
-- whose RLS policies already cover them).

NOTIFY pgrst, 'reload schema';
