import fs from "fs";
import path from "path";

const ZERO_STOCKS = new Set(["A73746", "030210", "C64906", "801683", "783279", "319735"]);
const SOLD_STOCKS_IN_ACTIVE30 = new Set([
  "313152",
  "100097",
  "588974",
  "342476",
  "038827",
  "DM8884",
  "319735",
]);
const LIGHTNING_STOCK = "DM 08379";
const MERCEDES_VIN = "55SWF8EB1KU319735";
const STUB_CUSTOMER_ID = 1608663;

export function vancouverDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Vancouver",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function str(v) {
  if (v == null) return "";
  return String(v).trim();
}

function noneToEmpty(v) {
  const s = str(v);
  if (!s || s.toLowerCase() === "none") return "";
  return s;
}

function num(v, fallback = 0) {
  if (v == null || v === "" || String(v).toLowerCase() === "none") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function numOrNull(v) {
  if (v == null || v === "" || String(v).toLowerCase() === "none") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function looksLikeEmail(v) {
  const s = str(v);
  return Boolean(s && s.includes("@") && !s.includes(" "));
}

function cleanPersonName(fName, lName, fullName) {
  const parts = [fName, lName]
    .map((x) => noneToEmpty(x))
    .filter(Boolean);
  if (parts.length) return parts.join(" ").replace(/\s+/g, " ").trim();
  const full = noneToEmpty(fullName);
  if (full && full.toLowerCase() !== "none none") return full.replace(/\s+/g, " ").trim();
  return null;
}

function parseFeatureToken(s) {
  if (typeof s !== "string") return null;
  const m = s.match(/^\$\d+\$(.*)$/);
  const t = (m ? m[1] : s).trim();
  return t || null;
}

function flattenFeatures(vehicle, moreOption) {
  const out = [];
  const seen = new Set();
  const add = (raw) => {
    const t = parseFeatureToken(raw) || (typeof raw === "string" ? raw.trim() : "");
    if (!t) return;
    const key = t.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(t);
  };
  const std = vehicle?.standard;
  if (std && typeof std === "object" && !Array.isArray(std)) {
    for (const key of ["SAFETY", "EXTERIOR", "INTERIOR", "MECHANICAL", "ENTERTAINMENT"]) {
      const arr = std[key];
      if (Array.isArray(arr)) arr.forEach(add);
    }
  } else if (Array.isArray(std)) {
    std.forEach(add);
  }
  const extra = moreOption;
  if (Array.isArray(extra)) extra.forEach(add);
  else if (typeof extra === "string" && extra.trim()) {
    extra.split(/[,;\n]/).forEach(add);
  }
  return out;
}

function normalizeFuel({ make, model, engine, engineType, engineSize, fuelType }) {
  const raw = str(fuelType).replace(/\s+Fuel$/i, "").trim() || null;
  const makeL = str(make).toLowerCase();
  const modelL = str(model).toLowerCase();
  const engineBlob = `${engine || ""} ${engineType || ""} ${engineSize || ""}`.toLowerCase();
  const isTesla = makeL.includes("tesla");
  const isLightning = modelL.includes("lightning");
  const isHummerEv = makeL.includes("hummer") && (modelL.includes("ev") || engineBlob.includes("electric"));
  let fuel = raw;
  let overridden = false;
  if (isTesla || isLightning || isHummerEv) {
    if (fuel !== "Electric") overridden = true;
    fuel = "Electric";
  } else if (/\belectric\b/.test(engineBlob) && !/hybrid/i.test(raw || "") && fuel !== "Electric") {
    // Don't rewrite Hybrids that list Electric motor/size.
    fuel = raw;
  }
  return { fuel, overridden, original: raw };
}

function mapHillzStatus(hillzStatus, soldDate, vinInClosedDeals) {
  if (hillzStatus === 7) return "Sold";
  if (hillzStatus === 4) return "Active";
  if (hillzStatus === 6) {
    if (soldDate || vinInClosedDeals) return "Sold";
    return "Pending";
  }
  if (soldDate || vinInClosedDeals) return "Sold";
  return "Active";
}

function colorName(c) {
  if (!c) return null;
  if (typeof c === "string") return noneToEmpty(c) || null;
  return noneToEmpty(c.name) || null;
}

function knownDamageFrom(disclosure) {
  const t = str(disclosure).toLowerCase();
  if (!t) return false;
  return /\bdamage\b|\baccident\b|\bsalvage\b/.test(t);
}

function bosFieldsFromFinal(finalArr) {
  const map = {};
  if (!Array.isArray(finalArr)) return map;
  for (const part of finalArr) {
    const items = part?.sec?.items || [];
    for (const it of items) {
      if (it?.part_name) map[it.part_name] = it.value;
    }
  }
  return map;
}

function moneyFromBos(v) {
  return num(v, 0);
}

function intFromBos(v) {
  const n = numOrNull(v);
  if (n == null) return null;
  return Math.round(n);
}

export function normalizeArchive(srcRoot) {
  const dataDir = fs.existsSync(path.join(srcRoot, "data"))
    ? path.join(srcRoot, "data")
    : srcRoot;
  const exceptions = [];
  const note = (kind, ref, message, extra = {}) => {
    exceptions.push({ kind, ref, message, ...extra });
  };

  const customersRaw = readJson(path.join(dataDir, "07_customers.json"));
  const listEnvelope = readJson(path.join(dataDir, "10_vehicles.json"));
  const listRows = listEnvelope.midVehicleDealerships || listEnvelope;
  const mechanic = readJson(path.join(dataDir, "11_mechanic_service_inventory.json"));
  const leadsRaw = readJson(path.join(dataDir, "15_leads.json"));
  const dealsEnvelope = readJson(path.join(dataDir, "19_deals_advanced_search.json"));
  const dealsRaw = dealsEnvelope.data || dealsEnvelope;
  const userInfo = readJson(path.join(dataDir, "01_user_info.json"));

  const detailsDir = path.join(dataDir, "vehicle_details");
  const imagesDir = path.join(dataDir, "images");

  const closedByVin = new Map();
  for (const row of dealsRaw) {
    const vin = row?.mvd?.Vehicle?.vin_number;
    if (!vin) {
      note("deal", String(row.billofsaleId), "Closed deal row missing VIN");
      continue;
    }
    const existing = closedByVin.get(vin) || [];
    existing.push(row);
    closedByVin.set(vin, existing);
  }
  const closedVins = new Set(closedByVin.keys());

  const adminByMvd = new Map();
  const bosByMvd = new Map();
  if (fs.existsSync(detailsDir)) {
    for (const name of fs.readdirSync(detailsDir)) {
      const full = path.join(detailsDir, name);
      if (name.endsWith("_billofsale.json")) {
        const mvdId = Number(name.replace("vehicle_", "").replace("_billofsale.json", ""));
        bosByMvd.set(mvdId, readJson(full));
      } else if (/^vehicle_\d+\.json$/.test(name)) {
        const raw = readJson(full);
        const mvd = raw.midVehicleDealership || raw;
        adminByMvd.set(mvd.id, mvd);
      }
    }
  }

  const imagesByMvd = new Map();
  let fullJpegCount = 0;
  if (fs.existsSync(imagesDir)) {
    for (const dirName of fs.readdirSync(imagesDir)) {
      const dir = path.join(imagesDir, dirName);
      if (!fs.statSync(dir).isDirectory()) continue;
      const files = fs
        .readdirSync(dir)
        .filter((f) => f.toLowerCase().endsWith(".jpg"))
        .sort()
        .map((f) => path.join(dir, f));
      const mvdId = Number(dirName);
      imagesByMvd.set(mvdId, files);
      fullJpegCount += files.length;
    }
  }

  const listById = new Map();
  for (const row of listRows) listById.set(row.id, row);

  const dealershipInfo = userInfo.dealershipInfo || {};
  const dealership = {
    hillz_id: String(dealershipInfo.id || 1558),
    name: DEALERSHIP_SAFE_NAME(dealershipInfo),
    slug: "drip-motors",
    business_name: dealershipInfo.bussiness_name || "Drip Motors Inc",
    business_email: dealershipInfo.owner_email || "info@dripmotors.ca",
    business_phone: dealershipInfo.business_phone || "778-594-8888",
    business_address: formatAddress(dealershipInfo),
    timezone: "America/Vancouver",
    settings: {
      timezone: "America/Vancouver",
      dealer_license: dealershipInfo.dealership_licence_number || dealershipInfo.dealer_NO || "D150626",
      license_number: dealershipInfo.dealership_licence_number || "D150626",
      gst_number: dealershipInfo.GST_NO || "728276221",
      hst_number: dealershipInfo.GST_NO || "728276221",
      dealer_number: dealershipInfo.dealership_licence_number || "D150626",
      hillz_dealership_id: 1558,
      source: "hillz-drip-1558",
    },
    subscription_limits: { users: 10, vehicles: 100, storage_gb: 20 },
  };

  const customers = [];
  for (const c of customersRaw) {
    if (c.id === STUB_CUSTOMER_ID) {
      note("customer", String(c.id), "Skipped None None stub customer dripmotorsinc");
      continue;
    }
    const name = cleanPersonName(c.f_name, c.l_name, c.full_name);
    if (!name) {
      note("customer", String(c.id), "Skipped customer with empty name");
      continue;
    }
    const cityRaw = c.city ?? c.City?.city ?? "";
    const email = looksLikeEmail(c.email) ? str(c.email) : null;
    if (c.email && !email) {
      note("customer", String(c.id), `Dropped non-email value ${JSON.stringify(c.email)}`);
    }
    customers.push({
      hillz_id: String(c.id),
      name,
      email,
      phone: str(c.mobile) || str(c.phone_number) || null,
      address: str(c.address) || null,
      city: str(cityRaw) || null,
      province: str(c.province) || null,
      postal_code: str(c.postalcode) || null,
      status: c.is_active || c.active ? "Active" : "Inactive",
      source: "hillz-drip-1558",
      driver_license_number: noneToEmpty(c.driver_license_NO) || null,
      marketing_consent: false,
      sms_consent: false,
      marketing_unsubscribed_at: c.updatedAt || c.createdAt || new Date().toISOString(),
      marketing_consent_source: "hillz-unsubscribe_status",
      notes: `hillz_customer_id=${c.id}`,
      created_at: c.createdAt || null,
    });
  }

  const vehicles = [];
  for (const mech of mechanic) {
    const mvdId = mech.id;
    const admin = adminByMvd.get(mvdId);
    const list = listById.get(mvdId);
    const source = admin || list || mech;
    const v = (admin || list)?.Vehicle || mech.Vehicle || {};
    const vin = v.vin_number;
    if (!vin) {
      note("vehicle", String(mvdId), "Missing VIN after merge — skipped");
      continue;
    }
    const hillzStatus = source.vehicle_status ?? mech.vehicle_status;
    const soldDate = source.sold_date || list?.sold_date || null;
    const stock = str(source.stock_NO || mech.stock_NO);
    const specDump = Boolean(admin);
    const closedRows = closedByVin.get(vin) || [];
    const status = mapHillzStatus(hillzStatus, soldDate, closedRows.length > 0);

    const fuelInfo = specDump
      ? normalizeFuel({
          make: v.make,
          model: v.model,
          engine: v.engine,
          engineType: v.engine_type,
          engineSize: v.engine_size,
          fuelType: v.fuel_type,
        })
      : { fuel: null, overridden: false, original: null };

    if (fuelInfo.overridden) {
      note("fuel_override", vin, `Overrode fuel ${fuelInfo.original || "null"} → Electric`, {
        stock,
        make: v.make,
        model: v.model,
      });
    }

    const images = (imagesByMvd.get(mvdId) || []).map((abs, i) => ({
      abs,
      basename: path.basename(abs),
      sort_order: i,
      storage_path: `${vin}/${String(i + 1).padStart(3, "0")}_${path.basename(abs)}`,
    }));

    if (vin === MERCEDES_VIN && images.length === 0) {
      note("missing_photos", vin, "Mercedes has 0 files (Azure deleted) — importing vehicle anyway", {
        stock,
      });
    } else if (specDump && images.length === 0) {
      note("missing_photos", vin, "Admin vehicle has 0 full-size JPEGs", { stock });
    }
    if (!specDump) {
      note("stub_sold", vin, "Sold-only mechanic row: VIN/YMM/stock/price only, no spec dump or photos", {
        stock,
        hillz_status: hillzStatus,
      });
    }

    const sellPrice = num(source.sell_price, 0);
    const specialPrice = numOrNull(source.special_price);
    const purchasePrice = num(source.purchase_price, 0);
    if (specDump && (sellPrice === 0 || ZERO_STOCKS.has(stock))) {
      note("zero_price", vin, "Listed at $0 — flagged, not rewritten", {
        stock,
        sell_price: sellPrice,
      });
    }
    if (stock === LIGHTNING_STOCK || sellPrice === 1071) {
      note("odd_price", vin, "F-150 Lightning listed at $1,071 — flagged, not rewritten", {
        stock,
        sell_price: sellPrice,
      });
    }

    const dealPrice = closedRows[0]?.profitData?.soldPrice;
    const retail = specDump ? sellPrice : num(dealPrice, 0);

    const engine = specDump
      ? [v.engine, v.engine_type, v.engine_size].map(noneToEmpty).filter(Boolean).join(" ").trim() || null
      : null;
    const transmission = specDump
      ? v.Transmission?.name || noneToEmpty(v.transmission) || null
      : null;
    const body = specDump
      ? source.BodyStyle?.name || v.BodyStyle?.name || noneToEmpty(v.body_style) || null
      : null;

    const flags = [];
    if (specDump && sellPrice === 0) flags.push("zero_price");
    if (fuelInfo.overridden) flags.push("fuel_override");
    if (vin === MERCEDES_VIN) flags.push("no_photos_azure");
    if (!specDump) flags.push("sold_only_stub");
    if (stock === LIGHTNING_STOCK) flags.push("odd_price_1071");

    vehicles.push({
      hillz_id: String(mvdId),
      hillz_vehicle_id: v.id ?? null,
      vin,
      stock_number: stock || null,
      year: Number(v.model_year) || 0,
      make: v.make || "Unknown",
      model: v.model || "Unknown",
      trim: specDump ? noneToEmpty(v.trim) || null : null,
      odometer: num(source.odometer ?? mech.odometer, 0),
      condition: source.is_certified ? "Certified" : "Used",
      status,
      hillz_status: hillzStatus,
      sold_date: soldDate,
      exterior_color: specDump ? colorName(v.exterior_color) : null,
      interior_color: specDump ? colorName(v.interior_color) : null,
      fuel_type: fuelInfo.fuel,
      transmission,
      drivetrain: specDump ? noneToEmpty(v.drive_type) || null : null,
      engine,
      body_style: body,
      doors: specDump ? numOrNull(v.doors) : null,
      passengers: specDump ? numOrNull(v.passenger ?? v.passengers) : null,
      purchase_price: purchasePrice,
      retail_price: retail,
      special_price: specDump ? specialPrice : null,
      msrp: specDump ? numOrNull(v.low_msrp) : null,
      city_fuel: specDump ? noneToEmpty(v.city_fuel) || null : null,
      highway_fuel: specDump ? noneToEmpty(v.hwy_fuel) || null : null,
      title_status: specDump ? source.TitleStatus?.name || null : null,
      warranty: specDump ? noneToEmpty(source.waranty) || null : null,
      disclosure: specDump ? noneToEmpty(source.disclosure) || null : null,
      youtube_url: specDump ? noneToEmpty(source.youtube_link) || null : null,
      carfax_report_url: specDump ? noneToEmpty(v.carfax_link) || null : null,
      description: specDump ? noneToEmpty(source.comment) || null : null,
      features: specDump ? flattenFeatures(v, source.more_option) : [],
      known_damage: specDump ? knownDamageFrom(source.disclosure) : false,
      source: "hillz-drip-1558",
      created_at: source.createdAt || mech.createdAt || null,
      spec_dump: specDump,
      images,
      internal_notes: flags.length
        ? `hillz_mvd_id=${mvdId}; flags=${flags.join(",")}`
        : `hillz_mvd_id=${mvdId}`,
    });
  }

  const vehiclesByVin = new Map(vehicles.map((v) => [v.vin, v]));

  const deals = [];
  for (const [vin, rows] of closedByVin) {
    rows.sort((a, b) => {
      const da = Date.parse(a.mvd?.sold_date || 0);
      const db = Date.parse(b.mvd?.sold_date || 0);
      if (db !== da) return db - da;
      return Number(b.billofsaleId) - Number(a.billofsaleId);
    });
    const primary = rows[0];
    const extraIds = rows.slice(1).map((r) => r.billofsaleId);
    if (extraIds.length) {
      note("dup_bos", vin, `Collapsed ${rows.length} Hillz BOS rows into one deal`, {
        kept: primary.billofsaleId,
        extra: extraIds.join(","),
      });
    }
    const mvd = primary.mvd || {};
    const profit = primary.profitData || {};
    const mvdId = mvd.id;
    const wizard = bosByMvd.get(mvdId);
    const bosMap = wizard ? bosFieldsFromFinal(wizard.Final) : {};
    const wizardCustomerId = wizard?.mvd_bos?.frk_customer_id
      ? String(wizard.mvd_bos.frk_customer_id)
      : null;

    const salePrice = moneyFromBos(bosMap.price_of_vehicle) || num(profit.soldPrice, 0);
    const gstAmount = moneyFromBos(bosMap.gst_on_purchase_price) || num(profit.billofsaleTaxes?.gst, 0);
    const pstAmount = moneyFromBos(bosMap.pst_on_purchase_price) || num(profit.billofsaleTaxes?.pst, 0);
    const totalFromBos = moneyFromBos(bosMap.total_purchase_price) || moneyFromBos(bosMap.price_balance_due);
    const finRow = (mvd.MidVDSFinancials || []).find((x) => x.document_type === 1);
    const totalAmount =
      totalFromBos ||
      num(finRow?.total_amount, 0) ||
      salePrice + gstAmount + pstAmount;

    const buyerName = noneToEmpty(bosMap.names) || noneToEmpty(profit.purchaser) || null;
    if (!buyerName) {
      note("deal_no_customer", vin, "Closed deal has no BOS customer name; recorded on vehicle only", {
        bos_id: primary.billofsaleId,
      });
    }
    if (!wizardCustomerId && !wizard) {
      note("deal_no_wizard", vin, "Sold-only deal has no per-vehicle BOS wizard file");
    }

    const financedAmt = moneyFromBos(bosMap.amount_to_finance) || moneyFromBos(bosMap.amount_to_financing);
    const notesParts = [
      `hillz_bos_id=${primary.billofsaleId}`,
      extraIds.length ? `extra_hillz_bos_ids=${extraIds.join(",")}` : null,
      wizardCustomerId ? `hillz_customer_id=${wizardCustomerId}` : null,
    ].filter(Boolean);

    deals.push({
      hillz_id: String(primary.billofsaleId),
      extra_hillz_bos_ids: extraIds.map(String),
      vin,
      hillz_mvd_id: String(mvdId),
      hillz_customer_id: wizardCustomerId,
      deal_date: vancouverDate(mvd.sold_date || wizard?.mvd_bos?.sold_date || wizard?.mvd_bos?.deal_date),
      sale_price: salePrice,
      down_payment: moneyFromBos(bosMap.price_downpayments),
      trade_in_value: moneyFromBos(bosMap.less_allowance_for_trade_in),
      deal_status: "Closed",
      financing_notes: financedAmt
        ? `amount_to_finance=${financedAmt}; rate=${bosMap.interest_rate_financing || ""}; term=${bosMap.financing_payments_term || ""}`
        : null,
      admin_fee: moneyFromBos(bosMap.admin_fee),
      total_price: totalAmount,
      notes: notesParts.join("; "),
      bos: {
        has_wizard: Boolean(wizard && buyerName),
        document_number: `HILLZ-${primary.billofsaleId}`,
        sale_date: vancouverDate(mvd.sold_date),
        buyer_name: buyerName || "Unknown Buyer",
        buyer_address: [noneToEmpty(bosMap.address), noneToEmpty(bosMap.city), noneToEmpty(bosMap.province), noneToEmpty(bosMap.postal_code)]
          .filter(Boolean)
          .join(", ") || null,
        buyer_phone: noneToEmpty(bosMap.cell_tel) || noneToEmpty(bosMap["res._tel"]) || noneToEmpty(bosMap.bus_tel) || null,
        buyer_email: looksLikeEmail(bosMap.email_address) ? str(bosMap.email_address) : null,
        buyer_dl_number: noneToEmpty(bosMap.driver_licence_no) || null,
        seller_name: primary.mvd_bos?.seller_full_name || "Drip Motors Inc",
        vehicle_description: [vehiclesByVin.get(vin)?.year, vehiclesByVin.get(vin)?.make, vehiclesByVin.get(vin)?.model]
          .filter(Boolean)
          .join(" "),
        sale_type: "Retail",
        vin,
        year: vehiclesByVin.get(vin)?.year || intFromBos(bosMap.vehicle_year),
        make: vehiclesByVin.get(vin)?.make || noneToEmpty(bosMap.vehicle_make) || null,
        model: vehiclesByVin.get(vin)?.model || noneToEmpty(bosMap.vehicle_series_and_model) || null,
        sale_price: salePrice,
        tax_amount: gstAmount + pstAmount,
        total_amount: totalAmount,
        odometer: intFromBos(bosMap.vehicle_odometer) || vehiclesByVin.get(vin)?.odometer || 0,
        odometer_reading: intFromBos(bosMap.delivery_odometer) || intFromBos(bosMap.vehicle_odometer),
        is_financed: financedAmt > 0,
        status: "Completed",
        payment_status: financedAmt > 0 ? "Financed" : "Not Paid",
        warranty_period: noneToEmpty(bosMap.warranty) || null,
        price_vehicle: salePrice,
        additional_equipment: moneyFromBos(bosMap.additional_equipments),
        services_warranties: moneyFromBos(bosMap.services_or_warranties),
        documentation_fees: moneyFromBos(bosMap.documentation_fees),
        vsa_levy_recovery: moneyFromBos(bosMap.levy_fee),
        extra_fee_1_taxable: moneyFromBos(bosMap.extra_fee_1),
        discount: moneyFromBos(bosMap.discount),
        subtotal: moneyFromBos(bosMap.subtotal),
        trade_in_allowance: moneyFromBos(bosMap.less_allowance_for_trade_in),
        net_difference: moneyFromBos(bosMap.net_difference),
        gst_rate: 5,
        gst_amount: gstAmount,
        pst_rate: 7,
        pst_amount: pstAmount,
        purchase_price_with_gst_pst: moneyFromBos(bosMap.purchase_price_with_gst_pst),
        gst_enabled: true,
        pst_enabled: true,
        licence_fee: moneyFromBos(bosMap.licence_fee),
        gasoline_fee: moneyFromBos(bosMap.gasoline),
        finance_fee: moneyFromBos(bosMap.finance_fee),
        lien_payout: moneyFromBos(bosMap.lien_payout_on_tradein),
        extra_fee_2_non_taxable: moneyFromBos(bosMap.extra_fee_2),
        sub_total: moneyFromBos(bosMap.subtotal2),
        deposit: moneyFromBos(bosMap.deposit),
        down_payments: moneyFromBos(bosMap.price_downpayments),
        down_payment: moneyFromBos(bosMap.price_downpayments),
        insurance_life: moneyFromBos(bosMap.life_insurance),
        insurance_gap: moneyFromBos(bosMap.disability_insurance),
        rst_on_insurance: moneyFromBos(bosMap.rst_on_insurance),
        total_purchase_price: moneyFromBos(bosMap.total_purchase_price) || totalAmount,
        ppsa_fee: moneyFromBos(bosMap.ppsa_fee),
        admin_fee: moneyFromBos(bosMap.admin_fee),
        amount_to_finance: financedAmt,
        total_balance_due: moneyFromBos(bosMap.price_balance_due) || financedAmt,
        payment_type: noneToEmpty(bosMap.payment_type) || null,
        cost_of_borrowing: moneyFromBos(bosMap.price_cost_of_borrowing),
        payment_start_date: noneToEmpty(bosMap.financing_payment_start_date) || null,
        finance_amount: financedAmt,
        finance_term: intFromBos(bosMap.financing_payments_term),
        interest_rate: numOrNull(bosMap.interest_rate_financing),
        finance_company: null,
        payment_frequency: noneToEmpty(bosMap.payment_type) || null,
        trade_in_year: intFromBos(bosMap.trade_in_year),
        trade_in_make: noneToEmpty(bosMap.trade_in_make) || null,
        trade_in_model: noneToEmpty(bosMap.trade_in_series_and_model) || null,
        trade_in_cylinders: intFromBos(bosMap.trade_in_number_of_cylinders),
        trade_in_odometer: intFromBos(bosMap.trade_in_odometer),
        trade_in_kms_miles: noneToEmpty(bosMap.trade_in_odometer_type) || "KMS",
        trade_in_exterior_color: noneToEmpty(bosMap.trade_in_exterior_color) || null,
        trade_in_interior_color: noneToEmpty(bosMap.trade_in_interior_color) || null,
        trade_in_vin: noneToEmpty(bosMap.trade_in_vin_numbe) || null,
        trade_in_stock_number: noneToEmpty(bosMap.trade_in_stock_number) || null,
        trade_in_owing_to: noneToEmpty(bosMap.trade_in_owing_to) || null,
        trade_in_odometer_delivery: intFromBos(bosMap.delivery_odometer),
        notes: notesParts.join("; "),
      },
    });
  }

  const leads = [];
  for (const L of leadsRaw) {
    const cust = L.customer || {};
    const formLead = L.formData?.lead?.values || {};
    const start = formLead.testDrive_start_date?.value || formLead.requested_date?.value || L.createdAt;
    const origSource = L.LeadName?.name || L.apiType || "Unknown";
    const origType = L.type != null ? String(L.type) : "";
    const notes = [
      `hillz_lead_id=${L.id}`,
      `orig_source=${origSource}${origType ? ` (${origType})` : ""}`,
      `hillz_status=${L.leadStatus || L.status}`,
      L.frk_midv_id ? `hillz_midv=${L.frk_midv_id}` : "no_vehicle",
      "RTD residual — no inventory vehicle attached; test_drive skipped",
    ].join("; ");
    leads.push({
      hillz_id: String(L.id),
      hillz_customer_id: cust.id ? String(cust.id) : null,
      source: "Walk-in",
      status: "Not Started",
      notes,
      lead_creation_date: L.createdAt || null,
      last_engagement: L.updatedAt || L.createdAt || null,
      skip_test_drive: true,
      requested_date: start || null,
    });
  }

  const active = vehicles.filter((v) => v.status === "Active");
  const sold = vehicles.filter((v) => v.status === "Sold");
  const pending = vehicles.filter((v) => v.status === "Pending");
  const leftoverHillz6Active = vehicles.filter(
    (v) => v.hillz_status === 6 && v.status === "Active"
  );
  const showroomEligible = vehicles.filter(
    (v) => v.status === "Active" && v.retail_price > 0 && v.images.length > 0
  );

  const summary = {
    customers: customers.length,
    vehicles: vehicles.length,
    active: active.length,
    sold: sold.length,
    pending: pending.length,
    leftover_hillz6_as_active: leftoverHillz6Active.length,
    images_full_jpeg: vehicles.reduce((n, v) => n + v.images.length, 0),
    images_disk: fullJpegCount,
    deals: deals.length,
    deals_with_wizard_bos: deals.filter((d) => d.bos.has_wizard).length,
    leads: leads.length,
    showroom_eligible: showroomEligible.length,
    exceptions: exceptions.length,
    expected: {
      vehicles: 72,
      images: 408,
      customers: 27,
      customers_source: 28,
      stub_skipped: 1,
      deals: 49,
      leads: 5,
      active: 23,
    },
  };

  return {
    generated_at: new Date().toISOString(),
    timezone: "America/Vancouver",
    dealership,
    customers,
    vehicles,
    deals,
    leads,
    exceptions,
    summary,
    closed_vins: [...closedVins],
    sold_stocks_in_active30: [...SOLD_STOCKS_IN_ACTIVE30],
  };
}

function DEALERSHIP_SAFE_NAME(info) {
  return info.bussiness_name || "Drip Motors Inc";
}

function formatAddress(info) {
  const street = str(info.business_street) || "Unit 102-6001 196 A St";
  const city = info.business_city?.city || "Langley";
  const postal = str(info.business_postal) || "V3A 1A8";
  return `${street}, ${city} BC ${postal}`.replace(/\s+/g, " ").trim();
}

export function toExceptionsCsv(exceptions) {
  const cols = ["kind", "ref", "message", "stock", "make", "model", "sell_price", "kept", "extra", "bos_id"];
  const esc = (v) => {
    if (v == null) return "";
    const s = String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [cols.join(",")];
  for (const e of exceptions) {
    lines.push(cols.map((c) => esc(e[c])).join(","));
  }
  return lines.join("\n") + "\n";
}

export function writeNormalized(bundle, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, "normalized.json");
  const csvPath = path.join(outDir, "exceptions.csv");
  const slim = {
    ...bundle,
    vehicles: bundle.vehicles.map((v) => ({
      ...v,
      images: v.images.map((im) => ({
        basename: im.basename,
        sort_order: im.sort_order,
        storage_path: im.storage_path,
        abs: im.abs,
      })),
    })),
  };
  fs.writeFileSync(jsonPath, JSON.stringify(slim, null, 2));
  fs.writeFileSync(csvPath, toExceptionsCsv(bundle.exceptions));
  return { jsonPath, csvPath };
}
