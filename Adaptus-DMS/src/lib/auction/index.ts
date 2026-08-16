/**
 * Auction / wholesale sourcing helpers.
 *
 * Honest design: this module captures WHERE a vehicle was sourced (auction
 * venue, lot number, sale date) and optional comp notes from the desk/AI. It
 * makes NO market-data claims — there is no configured market-data source, so
 * nothing here reports "market value", "retail wave", or pricing benchmarks.
 * It also never auto-bids.
 */

export const SOURCE_KINDS = [
  "public",
  "auction",
  "wholesale",
  "trade",
  "other",
] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];

export type AuctionLotInfo = {
  source_kind: SourceKind | null;
  auction_venue: string | null;
  auction_lot_number: string | null;
  auction_sale_date: string | null;
  comp_notes: string | null;
};

/** Fields accepted when capturing auction/wholesale sourcing info. */
export const AUCTION_SOURCE_FIELDS = [
  "source_kind",
  "auction_venue",
  "auction_lot_number",
  "auction_sale_date",
  "comp_notes",
] as const;

/** Validate + normalize a partial auction-lot payload from a form/API body. */
export function normalizeAuctionLotInfo(
  body: Record<string, unknown>
): AuctionLotInfo {
  const sourceKindRaw = body.source_kind;
  const sourceKind = SOURCE_KINDS.includes(sourceKindRaw as SourceKind)
    ? (sourceKindRaw as SourceKind)
    : null;

  const auction_venue =
    typeof body.auction_venue === "string" && body.auction_venue.trim()
      ? body.auction_venue.trim()
      : null;
  const auction_lot_number =
    typeof body.auction_lot_number === "string" && body.auction_lot_number.trim()
      ? body.auction_lot_number.trim()
      : null;
  const auction_sale_date =
    typeof body.auction_sale_date === "string" && body.auction_sale_date.trim()
      ? body.auction_sale_date.trim().slice(0, 10)
      : null;
  const comp_notes =
    typeof body.comp_notes === "string" && body.comp_notes.trim()
      ? body.comp_notes.trim()
      : null;

  return {
    source_kind: sourceKind,
    auction_venue,
    auction_lot_number,
    auction_sale_date,
    comp_notes,
  };
}

/** Human label for a source kind. */
export const SOURCE_KIND_LABELS: Record<SourceKind, string> = {
  public: "Public seller",
  auction: "Auction",
  wholesale: "Wholesale",
  trade: "Trade-in",
  other: "Other",
};

/**
 * Compose a human-readable provenance line. Honest: only what's actually
 * captured is shown. Never fabricates market data.
 */
export function provenanceLabel(info: {
  source_kind?: string | null;
  auction_venue?: string | null;
  auction_lot_number?: string | null;
  auction_sale_date?: string | null;
}): string | null {
  const kind = info.source_kind
    ? SOURCE_KIND_LABELS[info.source_kind as SourceKind] || info.source_kind
    : null;
  if (info.source_kind === "auction") {
    const parts: string[] = [];
    if (info.auction_venue) parts.push(info.auction_venue);
    if (info.auction_lot_number) parts.push(`Lot #${info.auction_lot_number}`);
    if (info.auction_sale_date) parts.push(info.auction_sale_date);
    if (parts.length > 0) return parts.join(" · ");
    return "Auction";
  }
  return kind || null;
}

export function isAuctionSourced(info: { source_kind?: string | null }): boolean {
  return info.source_kind === "auction";
}
