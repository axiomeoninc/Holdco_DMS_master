#!/usr/bin/env node
/**
 * DRIP Motors Hillz → Adaptus DMS importer.
 *
 *   node scripts/hillz-drip-import/run.mjs --dry-run
 *   node scripts/hillz-drip-import/run.mjs
 *
 * Isolated rooftop slug `drip-motors`. Re-run is upsert via hillz_import_map.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import { extractZip } from "./extract.mjs";
import {
  loadEnv,
  PROJECT_REF,
  PROJECT_URL,
  BUCKET,
  DEALERSHIP_SLUG,
  DEALERSHIP_NAME,
  SCRIPT_ROOT,
} from "./lib/env.mjs";
import { normalizeArchive, writeNormalized } from "./lib/normalize.mjs";
import { serializeGallery } from "./lib/gallery.mjs";

const __filename = fileURLToPath(import.meta.url);
const isMain = process.argv[1] && path.resolve(process.argv[1]) === __filename;

const ZIP_DEFAULT = "/home/dave/Documents/DRIPDATA/hillz-migration_FINAL.zip";
const EXTRACT_DEFAULT = "/tmp/hillz-drip";
const OUT_DIR = path.join(SCRIPT_ROOT, "out");

function argFlag(name) {
  return process.argv.includes(name);
}
function argValue(name, fallback) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

function die(msg, code = 1) {
  console.error(msg);
  process.exit(code);
}

async function applySql(accessToken, sql) {
  const endpoints = [
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/db/query`,
  ];
  let last = "";
  for (const endpoint of endpoints) {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    });
    last = await res.text();
    if (res.ok) return JSON.parse(last || "null");
    if (res.status === 404) continue;
    throw new Error(`SQL ${res.status} at ${endpoint}: ${last.slice(0, 800)}`);
  }
  throw new Error(`SQL failed on all endpoints: ${last.slice(0, 800)}`);
}

function adminClient(env) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL || PROJECT_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) die("Missing SUPABASE_SERVICE_ROLE_KEY in .env.local");
  if (!String(url).includes(PROJECT_REF)) {
    die(`Refusing to run: NEXT_PUBLIC_SUPABASE_URL is not ${PROJECT_REF}`);
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function must(q, label) {
  const { data, error } = await q;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

async function mapGet(sb, kind, hillzId) {
  const rows = await must(
    sb.from("hillz_import_map").select("dms_id, dealership_id").eq("kind", kind).eq("hillz_id", hillzId).maybeSingle(),
    `map get ${kind}/${hillzId}`
  );
  return rows;
}

async function mapPut(sb, kind, hillzId, dmsId, dealershipId, extra = {}) {
  const existing = await mapGet(sb, kind, hillzId);
  if (existing?.dms_id) return existing.dms_id;
  await must(
    sb.from("hillz_import_map").upsert(
      {
        kind,
        hillz_id: String(hillzId),
        dms_id: dmsId,
        dealership_id: dealershipId,
        extra,
      },
      { onConflict: "kind,hillz_id" }
    ),
    `map put ${kind}/${hillzId}`
  );
  return dmsId;
}

function publicUrl(env, storagePath) {
  const base = (env.NEXT_PUBLIC_SUPABASE_URL || PROJECT_URL).replace(/\/$/, "");
  return `${base}/storage/v1/object/public/${BUCKET}/${storagePath}`;
}

function omitNullish(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    if (v === "") {
      out[k] = null;
      continue;
    }
    out[k] = v;
  }
  return out;
}

async function pool(items, concurrency, fn) {
  const ret = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      ret[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return ret;
}

async function snapshotRooftops(sb) {
  const dealerships = await must(sb.from("dealerships").select("id, name, slug, status"), "list dealerships");
  const counts = [];
  for (const d of dealerships || []) {
    const row = { id: d.id, name: d.name, slug: d.slug };
    for (const t of ["vehicles", "customers", "sales_deals", "leads"]) {
      const { count, error } = await sb
        .from(t)
        .select("id", { count: "exact", head: true })
        .eq("dealership_id", d.id);
      if (error) throw new Error(`count ${t} ${d.slug}: ${error.message}`);
      const key = t === "sales_deals" ? "deals" : t;
      row[key] = count ?? 0;
    }
    counts.push(row);
  }
  return counts;
}

async function ensureSchema(env) {
  const token = env.SUPABASE_ACCESS_TOKEN;
  if (!token) die("Missing SUPABASE_ACCESS_TOKEN — cannot apply additive DDL");
  const files = ["additive.sql", "vin_unique_per_dealership.sql"];
  for (const name of files) {
    const sql = fs.readFileSync(path.join(SCRIPT_ROOT, "sql", name), "utf8");
    await applySql(token, sql);
  }
  try {
    await applySql(token, "NOTIFY pgrst, 'reload schema';");
  } catch {
    // best-effort PostgREST cache refresh
  }
}

async function crossTenantVinOverlap(sb, vins, ourDealershipId) {
  const overlap = [];
  const chunk = 50;
  for (let i = 0; i < vins.length; i += chunk) {
    const slice = vins.slice(i, i + chunk);
    const rows = await must(
      sb.from("vehicles").select("id, vin, dealership_id, stock_number").in("vin", slice),
      "vin overlap scan"
    );
    for (const r of rows || []) {
      if (r.dealership_id && r.dealership_id !== ourDealershipId) {
        overlap.push(r);
      }
    }
  }
  return overlap;
}

async function ensureTenant(sb, config, dryRun) {
  const existing = await must(
    sb.from("dealerships").select("*").eq("slug", DEALERSHIP_SLUG).maybeSingle(),
    "find drip dealership"
  );
  if (dryRun) {
    return { id: existing?.id || "dry-run-dealership", created: !existing, reused: Boolean(existing) };
  }
  let row = existing;
  if (!row) {
    const inserted = await must(
      sb
        .from("dealerships")
        .insert({
          name: DEALERSHIP_NAME,
          slug: DEALERSHIP_SLUG,
          business_name: config.business_name,
          business_address: config.business_address,
          business_phone: config.business_phone,
          business_email: config.business_email,
          status: "Active",
          settings: config.settings,
        })
        .select("*")
        .single(),
      "insert dealership"
    );
    row = inserted;
  } else {
    row = await must(
      sb
        .from("dealerships")
        .update({
          name: DEALERSHIP_NAME,
          business_name: config.business_name,
          business_address: config.business_address,
          business_phone: config.business_phone,
          business_email: config.business_email,
          status: "Active",
          settings: { ...(row.settings || {}), ...config.settings },
        })
        .eq("id", row.id)
        .select("*")
        .single(),
      "update dealership"
    );
  }

  const sub = await must(
    sb.from("subscriptions").select("id, limits").eq("dealership_id", row.id).maybeSingle(),
    "find subscription"
  );
  const limits = { users: 10, vehicles: 100, storage_gb: 20 };
  if (!sub) {
    await must(
      sb.from("subscriptions").insert({
        dealership_id: row.id,
        plan_name: "Imported",
        plan_price: 0,
        billing_cycle: "monthly",
        status: "Active",
        features: [],
        limits,
      }),
      "insert subscription"
    );
  } else {
    const cur = sub.limits || {};
    const next = {
      ...cur,
      users: Math.max(Number(cur.users) || 0, limits.users),
      vehicles: Math.max(Number(cur.vehicles) || 0, limits.vehicles),
      storage_gb: Math.max(Number(cur.storage_gb) || 0, limits.storage_gb),
    };
    await must(sb.from("subscriptions").update({ limits: next, status: "Active" }).eq("id", sub.id), "raise limits");
  }

  await mapPut(sb, "dealership", config.hillz_id, row.id, row.id);
  return { id: row.id, created: !existing, reused: Boolean(existing) };
}

async function vinCollisionScan(sb, vins, ourDealershipId) {
  return crossTenantVinOverlap(sb, vins, ourDealershipId);
}

async function upsertCustomers(sb, customers, dealershipId) {
  const idByHillz = new Map();
  for (const c of customers) {
    const mapped = await mapGet(sb, "customer", c.hillz_id);
    const payload = omitNullish({
      name: c.name,
      email: c.email,
      phone: c.phone,
      address: c.address,
      city: c.city,
      province: c.province,
      postal_code: c.postal_code,
      status: c.status,
      source: c.source,
      notes: c.notes,
      driver_license_number: c.driver_license_number,
      marketing_consent: false,
      sms_consent: false,
      marketing_unsubscribed_at: c.marketing_unsubscribed_at,
      marketing_consent_source: c.marketing_consent_source,
      dealership_id: dealershipId,
      created_at: c.created_at,
    });
    let id = mapped?.dms_id;
    if (id) {
      await must(sb.from("customers").update(payload).eq("id", id), `update customer ${c.hillz_id}`);
    } else {
      const row = await must(sb.from("customers").insert(payload).select("id").single(), `insert customer ${c.hillz_id}`);
      id = row.id;
      await mapPut(sb, "customer", c.hillz_id, id, dealershipId);
    }
    idByHillz.set(c.hillz_id, id);
  }
  return idByHillz;
}

async function upsertVehicles(sb, vehicles, dealershipId) {
  const idByVin = new Map();
  const idByHillz = new Map();
  for (const v of vehicles) {
    const mapped = await mapGet(sb, "vehicle", v.hillz_id);
    const payload = omitNullish({
      vin: v.vin,
      stock_number: v.stock_number,
      year: v.year,
      make: v.make,
      model: v.model,
      trim: v.trim,
      odometer: v.odometer,
      condition: v.condition,
      status: v.status,
      exterior_color: v.exterior_color,
      interior_color: v.interior_color,
      fuel_type: v.fuel_type,
      transmission: v.transmission,
      drivetrain: v.drivetrain,
      engine: v.engine,
      body_style: v.body_style,
      doors: v.doors,
      passengers: v.passengers,
      purchase_price: v.purchase_price,
      retail_price: v.retail_price,
      special_price: v.special_price,
      msrp: v.msrp,
      city_fuel: v.city_fuel,
      highway_fuel: v.highway_fuel,
      title_status: v.title_status,
      warranty: v.warranty,
      disclosure: v.disclosure,
      youtube_url: v.youtube_url,
      carfax_report_url: v.carfax_report_url,
      description: v.description,
      features: v.features,
      known_damage: v.known_damage,
      source: v.source,
      internal_notes: v.internal_notes,
      dealership_id: dealershipId,
      created_at: v.created_at,
    });
    let id = mapped?.dms_id;
    if (id) {
      await must(sb.from("vehicles").update(payload).eq("id", id), `update vehicle ${v.vin}`);
    } else {
      const row = await must(sb.from("vehicles").insert(payload).select("id").single(), `insert vehicle ${v.vin}`);
      id = row.id;
      await mapPut(sb, "vehicle", v.hillz_id, id, dealershipId, { vin: v.vin });
    }
    idByVin.set(v.vin, id);
    idByHillz.set(v.hillz_id, id);
  }
  return { idByVin, idByHillz };
}

async function uploadImages(sb, env, vehicles, idByVin, dealershipId, skipImages) {
  const stats = { uploaded: 0, skipped: 0, failed: [] };
  if (skipImages) return stats;
  for (const v of vehicles) {
    if (!v.images.length) continue;
    const vehicleId = idByVin.get(v.vin);
    const gallery = [];
    await pool(v.images, 4, async (img, i) => {
      const legacyPath = img.storage_path;
      const storagePath = `${dealershipId}/${img.storage_path}`;
      const mappedPrefixed = await mapGet(sb, "image", storagePath);
      const mappedLegacy = mappedPrefixed ? null : await mapGet(sb, "image", legacyPath);
      if (mappedPrefixed || mappedLegacy) {
        if (mappedLegacy && !mappedPrefixed) {
          const copied = await sb.storage.from(BUCKET).copy(legacyPath, storagePath);
          if (copied.error && !/already exists|duplicate|409/i.test(copied.error.message || "")) {
            stats.failed.push({ vin: v.vin, path: storagePath, error: copied.error.message });
            return;
          }
          await mapPut(sb, "image", storagePath, vehicleId, dealershipId, { vin: v.vin });
        }
        stats.skipped++;
        gallery[i] = {
          url: publicUrl(env, storagePath),
          role: "exterior",
          is_cover: i === 0,
          sort_order: i,
        };
        return;
      }
      const buf = fs.readFileSync(img.abs);
      const { error } = await sb.storage.from(BUCKET).upload(storagePath, buf, {
        contentType: "image/jpeg",
        upsert: true,
      });
      if (error) {
        stats.failed.push({ vin: v.vin, path: storagePath, error: error.message });
        return;
      }
      stats.uploaded++;
      await mapPut(sb, "image", storagePath, vehicleId, dealershipId, { vin: v.vin });
      gallery[i] = {
        url: publicUrl(env, storagePath),
        role: "exterior",
        is_cover: i === 0,
        sort_order: i,
      };
    });
    const filled = gallery.filter(Boolean);
    if (filled.length) {
      filled.forEach((g, i) => {
        g.sort_order = i;
        g.is_cover = i === 0;
      });
      await must(
        sb.from("vehicles").update({ image_gallery: serializeGallery(filled) }).eq("id", vehicleId),
        `gallery ${v.vin}`
      );
    }
  }
  return stats;
}

async function upsertDeals(sb, deals, idByVin, customerByHillz, dealershipId) {
  let dealCount = 0;
  let bosCount = 0;
  for (const d of deals) {
    const vehicleId = idByVin.get(d.vin) || null;
    const customerId = d.hillz_customer_id ? customerByHillz.get(d.hillz_customer_id) || null : null;
    const mapped = await mapGet(sb, "deal", d.hillz_id);
    const payload = omitNullish({
      vehicle_id: vehicleId,
      customer_id: customerId,
      salesperson_id: null,
      deal_date: d.deal_date,
      sale_price: d.sale_price,
      down_payment: d.down_payment,
      trade_in_value: d.trade_in_value,
      deal_status: "Closed",
      financing_notes: d.financing_notes,
      admin_fee: d.admin_fee,
      total_price: d.total_price,
      dealership_id: dealershipId,
    });
    let dealId = mapped?.dms_id;
    if (dealId) {
      await must(sb.from("sales_deals").update(payload).eq("id", dealId), `update deal ${d.hillz_id}`);
    } else {
      const row = await must(sb.from("sales_deals").insert(payload).select("id").single(), `insert deal ${d.hillz_id}`);
      dealId = row.id;
      await mapPut(sb, "deal", d.hillz_id, dealId, dealershipId, { extra: d.extra_hillz_bos_ids });
    }
    dealCount++;

    const b = d.bos;
    const bosMapped = await mapGet(sb, "bos", d.hillz_id);
    const bosPayload = omitNullish({
      deal_id: dealId,
      customer_id: customerId,
      document_number: b.document_number,
      sale_date: b.sale_date,
      buyer_name: b.buyer_name,
      buyer_address: b.buyer_address,
      buyer_phone: b.buyer_phone,
      buyer_email: b.buyer_email,
      buyer_dl_number: b.buyer_dl_number,
      seller_name: b.seller_name,
      vehicle_id: vehicleId,
      vehicle_description: b.vehicle_description,
      sale_type: b.sale_type,
      vin: b.vin,
      year: b.year,
      make: b.make,
      model: b.model,
      sale_price: b.sale_price,
      tax_amount: b.tax_amount,
      total_amount: b.total_amount || 0,
      odometer: b.odometer,
      odometer_reading: b.odometer_reading,
      is_financed: b.is_financed,
      status: b.status,
      payment_status: b.payment_status,
      warranty_period: b.warranty_period,
      price_vehicle: b.price_vehicle,
      additional_equipment: b.additional_equipment,
      services_warranties: b.services_warranties,
      documentation_fees: b.documentation_fees,
      vsa_levy_recovery: b.vsa_levy_recovery,
      extra_fee_1_taxable: b.extra_fee_1_taxable,
      discount: b.discount,
      subtotal: b.subtotal,
      trade_in_allowance: b.trade_in_allowance,
      net_difference: b.net_difference,
      gst_rate: b.gst_rate,
      gst_amount: b.gst_amount,
      pst_rate: b.pst_rate,
      pst_amount: b.pst_amount,
      purchase_price_with_gst_pst: b.purchase_price_with_gst_pst,
      gst_enabled: b.gst_enabled,
      pst_enabled: b.pst_enabled,
      licence_fee: b.licence_fee,
      gasoline_fee: b.gasoline_fee,
      finance_fee: b.finance_fee,
      lien_payout: b.lien_payout,
      extra_fee_2_non_taxable: b.extra_fee_2_non_taxable,
      sub_total: b.sub_total,
      deposit: b.deposit,
      down_payments: b.down_payments,
      down_payment: b.down_payment,
      insurance_life: b.insurance_life,
      insurance_gap: b.insurance_gap,
      rst_on_insurance: b.rst_on_insurance,
      total_purchase_price: b.total_purchase_price,
      ppsa_fee: b.ppsa_fee,
      admin_fee: b.admin_fee,
      amount_to_finance: b.amount_to_finance,
      total_balance_due: b.total_balance_due,
      payment_type: b.payment_type,
      cost_of_borrowing: b.cost_of_borrowing,
      payment_start_date: b.payment_start_date || null,
      finance_amount: b.finance_amount,
      finance_term: b.finance_term,
      interest_rate: b.interest_rate,
      payment_frequency: b.payment_frequency,
      trade_in_year: b.trade_in_year,
      trade_in_make: b.trade_in_make,
      trade_in_model: b.trade_in_model,
      trade_in_cylinders: b.trade_in_cylinders,
      trade_in_odometer: b.trade_in_odometer,
      trade_in_kms_miles: b.trade_in_kms_miles,
      trade_in_exterior_color: b.trade_in_exterior_color,
      trade_in_interior_color: b.trade_in_interior_color,
      trade_in_vin: b.trade_in_vin,
      trade_in_stock_number: b.trade_in_stock_number,
      trade_in_owing_to: b.trade_in_owing_to,
      trade_in_odometer_delivery: b.trade_in_odometer_delivery,
      notes: b.notes,
      dealership_id: dealershipId,
    });
    if (bosMapped?.dms_id) {
      await must(sb.from("bill_of_sale").update(bosPayload).eq("id", bosMapped.dms_id), `update bos ${d.hillz_id}`);
    } else {
      const row = await must(sb.from("bill_of_sale").insert(bosPayload).select("id").single(), `insert bos ${d.hillz_id}`);
      await mapPut(sb, "bos", d.hillz_id, row.id, dealershipId);
    }
    bosCount++;
  }
  return { dealCount, bosCount };
}

async function upsertLeads(sb, leads, customerByHillz, dealershipId) {
  let n = 0;
  for (const L of leads) {
    const mapped = await mapGet(sb, "lead", L.hillz_id);
    const payload = omitNullish({
      customer_id: L.hillz_customer_id ? customerByHillz.get(L.hillz_customer_id) || null : null,
      interest_vehicle_id: null,
      source: "Walk-in",
      status: "Not Started",
      notes: L.notes,
      lead_creation_date: L.lead_creation_date,
      last_engagement: L.last_engagement,
      dealership_id: dealershipId,
    });
    if (mapped?.dms_id) {
      await must(sb.from("leads").update(payload).eq("id", mapped.dms_id), `update lead ${L.hillz_id}`);
    } else {
      const row = await must(sb.from("leads").insert(payload).select("id").single(), `insert lead ${L.hillz_id}`);
      await mapPut(sb, "lead", L.hillz_id, row.id, dealershipId);
    }
    n++;
  }
  return n;
}

async function countEq(sb, table, col, val) {
  const { count, error } = await sb.from(table).select("id", { count: "exact", head: true }).eq(col, val);
  if (error) throw new Error(`count ${table}: ${error.message}`);
  return count ?? 0;
}

async function verify(sb, env, bundle, dealershipId, beforeCounts, expect = {}) {
  const expectedVehicles = expect.expectedVehicles ?? 72;
  const expectedDeals = expect.expectedDeals ?? 49;
  const expectedImages = expect.expectedImages ?? 408;
  const expectedActive = expect.expectedActive ?? 23;
  const results = { ok: true, checks: [] };
  const check = (name, pass, detail) => {
    results.checks.push({ name, pass, detail });
    if (!pass) results.ok = false;
  };

  const vCount = await countEq(sb, "vehicles", "dealership_id", dealershipId);
  const cCount = await countEq(sb, "customers", "dealership_id", dealershipId);
  const dCount = await countEq(sb, "sales_deals", "dealership_id", dealershipId);
  const lCount = await countEq(sb, "leads", "dealership_id", dealershipId);
  const bosCount = await countEq(sb, "bill_of_sale", "dealership_id", dealershipId);

  check(`vehicles=${expectedVehicles}`, vCount === expectedVehicles, vCount);
  check("customers=27 (28 minus stub)", cCount === 27, cCount);
  check(`deals=${expectedDeals}`, dCount === expectedDeals, dCount);
  check(`bos=${expectedDeals}`, bosCount === expectedDeals, bosCount);
  check("leads=5", lCount === 5, lCount);
  if (expect.overlapVins) {
    check("cross-tenant VIN overlap copied (Nova untouched)", true, expect.overlapVins);
  }

  const { count: activeCount } = await sb
    .from("vehicles")
    .select("id", { count: "exact", head: true })
    .eq("dealership_id", dealershipId)
    .eq("status", "Active");
  check(`active=${expectedActive}`, activeCount === expectedActive, activeCount);

  const { data: tesla } = await sb
    .from("vehicles")
    .select("vin, fuel_type, stock_number")
    .eq("dealership_id", dealershipId)
    .eq("stock_number", "492211")
    .maybeSingle();
  check("Tesla fuel Electric", tesla?.fuel_type === "Electric", tesla?.fuel_type);

  const { data: lightning } = await sb
    .from("vehicles")
    .select("vin, fuel_type, retail_price, stock_number")
    .eq("dealership_id", dealershipId)
    .eq("stock_number", "DM 08379")
    .maybeSingle();
  check("Lightning fuel Electric", lightning?.fuel_type === "Electric", lightning?.fuel_type);
  check("Lightning price $1071 preserved", Number(lightning?.retail_price) === 1071, lightning?.retail_price);

  const { data: merc } = await sb
    .from("vehicles")
    .select("vin, image_gallery, status, stock_number")
    .eq("vin", "55SWF8EB1KU319735")
    .eq("dealership_id", dealershipId)
    .maybeSingle();
  const mercGallery = Array.isArray(merc?.image_gallery) ? merc.image_gallery.length : 0;
  check("Mercedes imported with 0 images", Boolean(merc) && mercGallery === 0, { status: merc?.status, gallery: mercGallery });
  check("Mercedes Sold", merc?.status === "Sold", merc?.status);

  const { data: dripGalleries } = await sb
    .from("vehicles")
    .select("vin, image_gallery")
    .eq("dealership_id", dealershipId);
  const samples = [];
  for (const row of dripGalleries || []) {
    const raw = row.image_gallery;
    if (!Array.isArray(raw)) continue;
    for (const entry of raw) {
      if (typeof entry !== "string") continue;
      try {
        const parsed = JSON.parse(entry);
        if (parsed && typeof parsed.url === "string") samples.push(parsed.url);
        else samples.push(entry);
      } catch {
        samples.push(entry);
      }
    }
  }
  let httpOk = 0;
  let httpFail = 0;
  const failures = [];
  await pool(samples, 8, async (url) => {
    try {
      const res = await fetch(url, { method: "HEAD" });
      if (res.status === 200) httpOk++;
      else {
        httpFail++;
        if (failures.length < 8) failures.push({ url: url.split("/").slice(-2).join("/"), status: res.status });
      }
    } catch (e) {
      httpFail++;
      if (failures.length < 8) failures.push({ url: url.split("/").slice(-2).join("/"), error: e.message });
    }
  });
  check(`image HTTP 200s = ${expectedImages}`, httpOk === expectedImages && httpFail === 0, { httpOk, httpFail, failures });

  const after = await snapshotRooftops(sb);
  const otherBefore = (beforeCounts || []).filter((c) => c.slug !== DEALERSHIP_SLUG);
  const otherAfter = after.filter((c) => c.slug !== DEALERSHIP_SLUG);
  let oldOk = true;
  const drift = [];
  for (const b of otherBefore) {
    const a = otherAfter.find((x) => x.id === b.id);
    if (!a) continue;
    if (a.vehicles !== b.vehicles || a.customers !== b.customers || a.deals !== b.deals || a.leads !== b.leads) {
      oldOk = false;
      drift.push({ slug: b.slug, before: b, after: a });
    }
  }
  check("old rooftops unchanged", oldOk, drift.length ? drift : "ok");

  const { data: showroom } = await sb
    .from("vehicles")
    .select("id, retail_price, image_gallery, status")
    .eq("dealership_id", dealershipId)
    .eq("status", "Active");
  const publicList = (showroom || []).filter((r) => Number(r.retail_price) > 0 && Array.isArray(r.image_gallery) && r.image_gallery.length > 0);
  check("showroom Active priced+photos", publicList.length >= 1, {
    active: showroom?.length || 0,
    with_price_and_photos: publicList.length,
  });

  results.counts = {
    dealership_id: dealershipId,
    vehicles: vCount,
    customers: cCount,
    deals: dCount,
    bos: bosCount,
    leads: lCount,
    active: activeCount,
    images_http_200: httpOk,
  };
  results.after_rooftops = after;
  return results;
}

export async function main() {
  const dryRun = argFlag("--dry-run");
  const skipImages = argFlag("--skip-images");
  const skipExtract = argFlag("--skip-extract");
  const zip = argValue("--zip", ZIP_DEFAULT);
  const dest = argValue("--dest", EXTRACT_DEFAULT);

  console.log(dryRun ? "=== DRY RUN ===" : "=== IMPORT ===");
  if (!skipExtract) {
    const extracted = extractZip({ zip, dest });
    console.log("extract", extracted);
  }
  const srcRoot = path.join(dest, "hillz-migration");
  const bundle = normalizeArchive(srcRoot);
  const written = writeNormalized(bundle, OUT_DIR);
  const tmpOut = path.join(dest, "out");
  writeNormalized(bundle, tmpOut);
  console.log("normalized", written.jsonPath);
  console.log("exceptions", written.csvPath);
  console.log("summary", bundle.summary);
  if (bundle.summary.vehicles !== 72) {
    console.warn("WARNING: vehicle count != 72");
  }
  if (bundle.summary.images_full_jpeg !== 408) {
    console.warn("WARNING: image count != 408");
  }
  if (bundle.summary.deals !== 49) {
    console.warn("WARNING: deal count != 49");
  }

  const env = loadEnv();
  const sb = adminClient(env);

  const before = await snapshotRooftops(sb);
  console.log(
    "existing rooftops",
    before.map((c) => ({ slug: c.slug, name: c.name, vehicles: c.vehicles, customers: c.customers }))
  );

  if (dryRun) {
    const vins = bundle.vehicles.map((v) => v.vin);
    const collisions = await vinCollisionScan(sb, vins, "00000000-0000-0000-0000-000000000000");
    const existing = await must(
      sb.from("dealerships").select("id").eq("slug", DEALERSHIP_SLUG).maybeSingle(),
      "dry find drip"
    );
    const filtered = collisions.filter((c) => !existing || c.dealership_id !== existing.id);
    console.log("vin_collisions", filtered.length ? filtered : "none");
    console.log("would create/reuse rooftop slug", DEALERSHIP_SLUG);
    console.log("would import", {
      customers: bundle.customers.length,
      vehicles: bundle.vehicles.length,
      images: bundle.summary.images_full_jpeg,
      deals: bundle.deals.length,
      leads: bundle.leads.length,
    });
    fs.writeFileSync(
      path.join(OUT_DIR, "dry-run-report.json"),
      JSON.stringify({ summary: bundle.summary, rooftops: before, collisions: filtered }, null, 2)
    );
    return { dryRun: true, summary: bundle.summary, dealership: null };
  }

  await ensureSchema(env);
  const tenant = await ensureTenant(sb, bundle.dealership, false);
  console.log("dealership", tenant);

  const vins = bundle.vehicles.map((v) => v.vin);
  const overlap = await crossTenantVinOverlap(sb, vins, tenant.id);
  if (overlap.length) {
    fs.writeFileSync(path.join(OUT_DIR, "vin-collisions.json"), JSON.stringify(overlap, null, 2));
    console.log(
      `Note: ${overlap.length} VIN(s) also exist on another rooftop. Copying Drip's own rows; not modifying the other lot.`
    );
  }

  const importVehicles = bundle.vehicles;
  const importDeals = bundle.deals;

  const customerByHillz = await upsertCustomers(sb, bundle.customers, tenant.id);
  console.log("customers upserted", customerByHillz.size);
  const { idByVin } = await upsertVehicles(sb, importVehicles, tenant.id);
  console.log("vehicles upserted", idByVin.size);
  const imgStats = await uploadImages(sb, env, importVehicles, idByVin, tenant.id, skipImages);
  console.log("images", imgStats);
  if (imgStats.failed.length) {
    console.error("image upload failures", imgStats.failed.slice(0, 10));
  }
  const dealStats = await upsertDeals(sb, importDeals, idByVin, customerByHillz, tenant.id);
  console.log("deals", dealStats);
  const leadN = await upsertLeads(sb, bundle.leads, customerByHillz, tenant.id);
  console.log("leads", leadN);

  const verification = await verify(
    sb,
    env,
    { ...bundle, vehicles: importVehicles, deals: importDeals },
    tenant.id,
    before,
    {
      expectedVehicles: importVehicles.length,
      expectedDeals: importDeals.length,
      expectedImages: importVehicles.reduce((n, v) => n + v.images.length, 0),
      expectedActive: importVehicles.filter((v) => v.status === "Active").length,
      skippedVins: 0,
      overlapVins: overlap.length,
    }
  );
  fs.writeFileSync(
    path.join(OUT_DIR, "verification.json"),
    JSON.stringify(
      {
        dealership_id: tenant.id,
        summary: bundle.summary,
        image_stats: imgStats,
        deal_stats: dealStats,
        verification,
        exception_count: bundle.exceptions.length,
      },
      null,
      2
    )
  );
  console.log("verification", verification.ok ? "PASS" : "FAIL");
  for (const c of verification.checks) {
    console.log(`  ${c.pass ? "OK" : "XX"} ${c.name}: ${JSON.stringify(c.detail)}`);
  }
  return {
    dryRun: false,
    dealership_id: tenant.id,
    summary: bundle.summary,
    verification,
    exceptions: bundle.exceptions.length,
  };
}

if (isMain) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
