#!/usr/bin/env node
/**
 * Live isolation + completeness audit (Drip vs Nova).
 * Writes scripts/hillz-drip-import/out/isolation-audit.json
 * Never prints secrets.
 *
 *   node scripts/hillz-drip-import/audit-isolation.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { loadEnv, PROJECT_URL, BUCKET, SCRIPT_ROOT } from "./lib/env.mjs";
import { galleryHttpUrls } from "./lib/gallery.mjs";

const OUT_DIR = path.join(SCRIPT_ROOT, "out");
const DRIP_ID = "4d43b08c-3d56-4b3f-b465-c8dd5d50e62e";
const NOVA_ID = "dd404bb6-3e64-43ae-9eb7-98095033c6cb";
const EMPTY_ID = "efe720c0-477e-45bf-a0a7-f6ebc1d984bd";
const DRIP_SLUG = "drip-motors";
const NOVA_SLUG = "nova-motors";
const DRIP_EMAIL = "info@dripmotors.ca";
const NOVA_EMAIL = "ashish@novamotor.ca";
const MERC_VIN = "55SWF8EB1KU319735";
const APP_BASES = [
  "https://app.flashfender.com",
  "https://dms.adaptusgroup.ca",
];
const PUBLIC_MARKER = `/object/public/${BUCKET}/`;
const SPOT_VINS = [
  "55SWF8EB1KU319735",
  "5YJ3E1EA2PF492211",
  "1FTVW1EL4PWG08379",
  "SALWR2RK9JA181555",
  "2HGFC2F56KH000861",
  "JM1BPADM8S1789602",
  "1FATP8EM0G5313152",
  "5TDZK3DC1GS744821",
  "55SWF4KB8GU164525",
  "1G1BE5SMXJ7164932",
];

function bucketPathFromUrl(url) {
  if (!url || typeof url !== "string") return null;
  const i = url.indexOf(PUBLIC_MARKER);
  if (i < 0) return null;
  const raw = url.slice(i + PUBLIC_MARKER.length).split("?")[0];
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

async function countEq(sb, table, col, id) {
  const { count, error } = await sb
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq(col, id);
  if (error) throw new Error(`${table} count: ${error.message}`);
  return count ?? 0;
}

async function sessionFor(sb, email) {
  const { data, error } = await sb.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (error) return { error: error.message, accessToken: null };
  const tokenHash = data?.properties?.hashed_token;
  if (!tokenHash) return { error: "no hashed_token", accessToken: null };
  const { data: sessionData, error: vErr } = await sb.auth.verifyOtp({
    type: "email",
    token_hash: tokenHash,
  });
  if (vErr) return { error: vErr.message, accessToken: null };
  return { error: null, accessToken: sessionData?.session?.access_token || null };
}

async function apiGet(base, pathname, token, extraHeaders = {}) {
  const res = await fetch(`${base}${pathname}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      ...extraHeaders,
    },
  });
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body };
}

async function pickAppBase(token) {
  for (const base of APP_BASES) {
    try {
      const probe = await apiGet(base, "/api/vehicles?limit=1", token);
      if (probe.status !== 404 && probe.status !== 0) {
        return { base, probeStatus: probe.status };
      }
    } catch (err) {
      /* try next */
    }
  }
  return { base: APP_BASES[0], probeStatus: null };
}

function idsOf(body) {
  const rows = body?.data;
  if (!Array.isArray(rows)) return [];
  return rows.map((r) => r.id).filter(Boolean);
}

async function headOk(url) {
  try {
    const res = await fetch(url, { method: "HEAD" });
    return res.status === 200;
  } catch {
    return false;
  }
}

async function collectAll(sb, table, select, dealershipId) {
  const { data, error } = await sb
    .from(table)
    .select(select)
    .eq("dealership_id", dealershipId);
  if (error) throw new Error(`${table}: ${error.message}`);
  return data || [];
}

function featureCount(features) {
  if (Array.isArray(features)) return features.length;
  if (typeof features === "string") {
    try {
      const parsed = JSON.parse(features);
      return Array.isArray(parsed) ? parsed.length : 0;
    } catch {
      return features ? 1 : 0;
    }
  }
  return 0;
}

async function main() {
  const env = loadEnv();
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error("missing service role");
  const sb = createClient(PROJECT_URL, serviceKey, { auth: { persistSession: false } });
  const normalized = JSON.parse(
    fs.readFileSync(path.join(OUT_DIR, "normalized.json"), "utf8")
  );

  const report = {
    generated_at: new Date().toISOString(),
    drip_id: DRIP_ID,
    nova_id: NOVA_ID,
    empty_clone_id: EMPTY_ID,
    counts: {},
    shared_vins: [],
    gallery: {},
    jwt: {},
    public_slugs: {},
    completeness: {},
    spot_check: [],
    empty_clone: {},
    nova_untouched: {},
    ok: true,
    failures: [],
  };

  const fail = (name, detail) => {
    report.ok = false;
    report.failures.push({ name, detail });
  };

  const rooftops = {};
  for (const id of [DRIP_ID, NOVA_ID, EMPTY_ID]) {
    rooftops[id] = {
      vehicles: await countEq(sb, "vehicles", "dealership_id", id),
      customers: await countEq(sb, "customers", "dealership_id", id),
      deals: await countEq(sb, "sales_deals", "dealership_id", id),
      bos: await countEq(sb, "bill_of_sale", "dealership_id", id),
      leads: await countEq(sb, "leads", "dealership_id", id),
    };
  }
  const { data: dealerRows } = await sb
    .from("dealerships")
    .select("id, name, slug")
    .in("id", [DRIP_ID, NOVA_ID, EMPTY_ID]);
  for (const row of dealerRows || []) {
    rooftops[row.id].name = row.name;
    rooftops[row.id].slug = row.slug;
  }
  report.counts = rooftops;
  report.empty_clone = rooftops[EMPTY_ID];

  if (rooftops[NOVA_ID].vehicles !== 158) fail("nova vehicles", rooftops[NOVA_ID].vehicles);
  if (rooftops[NOVA_ID].customers !== 191) fail("nova customers", rooftops[NOVA_ID].customers);
  if (rooftops[NOVA_ID].deals !== 78) fail("nova deals", rooftops[NOVA_ID].deals);
  if (rooftops[NOVA_ID].leads !== 141) fail("nova leads", rooftops[NOVA_ID].leads);

  const dripVehicles = await collectAll(
    sb,
    "vehicles",
    "id, vin, stock_number, retail_price, special_price, dealership_id, status, year, make, model, description, features, image_gallery",
    DRIP_ID
  );
  const novaVehicles = await collectAll(
    sb,
    "vehicles",
    "id, vin, stock_number, retail_price, special_price, dealership_id, status, image_gallery",
    NOVA_ID
  );
  const dripByVin = new Map(dripVehicles.map((v) => [v.vin, v]));
  const novaByVin = new Map(novaVehicles.map((v) => [v.vin, v]));
  const shared = [...dripByVin.keys()].filter((vin) => novaByVin.has(vin)).sort();
  report.shared_vins = shared.map((vin) => {
    const d = dripByVin.get(vin);
    const n = novaByVin.get(vin);
    const dUrls = galleryHttpUrls(d.image_gallery);
    const nUrls = galleryHttpUrls(n.image_gallery);
    const dPaths = dUrls.map(bucketPathFromUrl).filter(Boolean);
    const nPaths = nUrls.map(bucketPathFromUrl).filter(Boolean);
    const samePath = dPaths.some((p) => nPaths.includes(p));
    const dripPrefixed = dPaths.length === 0 || dPaths.every((p) => p.startsWith(`${DRIP_ID}/`));
    const row = {
      vin,
      drip_id: d.id,
      nova_id: n.id,
      drip_stock: d.stock_number,
      nova_stock: n.stock_number,
      same_uuid: d.id === n.id,
      same_stock: d.stock_number === n.stock_number,
      same_gallery_object_path: samePath,
      drip_gallery_prefixed: dripPrefixed,
    };
    if (d.id === n.id) fail("shared VIN same uuid", vin);
    if (samePath) fail("shared VIN same gallery path", vin);
    if (!dripPrefixed) fail("shared VIN drip gallery unprefixed", vin);
    return row;
  });
  if (shared.length !== 19) fail("shared VIN count", shared.length);

  let dripUrls = 0;
  let dripPrefixed = 0;
  let dripUnprefixed = 0;
  let dripUnprefixedOverlap = 0;
  const unprefixedSamples = [];
  for (const v of dripVehicles) {
    const urls = galleryHttpUrls(v.image_gallery);
    dripUrls += urls.length;
    for (const url of urls) {
      const p = bucketPathFromUrl(url);
      if (p && p.startsWith(`${DRIP_ID}/`)) dripPrefixed++;
      else {
        dripUnprefixed++;
        if (novaByVin.has(v.vin)) dripUnprefixedOverlap++;
        if (unprefixedSamples.length < 8) unprefixedSamples.push({ vin: v.vin, url });
      }
    }
  }
  report.gallery = {
    drip_http_urls: dripUrls,
    drip_prefixed: dripPrefixed,
    drip_unprefixed: dripUnprefixed,
    drip_unprefixed_on_shared_vin: dripUnprefixedOverlap,
    unprefixed_samples: unprefixedSamples,
  };
  if (dripUnprefixedOverlap) fail("overlap VIN unprefixed drip photos", dripUnprefixedOverlap);

  const merc = dripByVin.get(MERC_VIN);
  report.gallery.mercedes = {
    present: Boolean(merc),
    status: merc?.status ?? null,
    gallery: merc ? galleryHttpUrls(merc.image_gallery).length : null,
  };

  const dripJwt = await sessionFor(sb, DRIP_EMAIL);
  const novaJwt = await sessionFor(sb, NOVA_EMAIL);
  report.jwt.drip_session = Boolean(dripJwt.accessToken);
  report.jwt.nova_session = Boolean(novaJwt.accessToken);
  if (dripJwt.error) report.jwt.drip_error = dripJwt.error;
  if (novaJwt.error) report.jwt.nova_error = novaJwt.error;

  if (dripJwt.accessToken && novaJwt.accessToken) {
    const { base } = await pickAppBase(dripJwt.accessToken);
    report.jwt.app_base = base;
    const dripVeh = await apiGet(base, "/api/vehicles?limit=500", dripJwt.accessToken);
    const novaVeh = await apiGet(base, "/api/vehicles?limit=500", novaJwt.accessToken);
    const dripCust = await apiGet(base, "/api/customers?limit=500", dripJwt.accessToken);
    const novaCust = await apiGet(base, "/api/customers?limit=500", novaJwt.accessToken);
    const dripDeals = await apiGet(base, "/api/deals?limit=500", dripJwt.accessToken);
    const novaDeals = await apiGet(base, "/api/deals?limit=500", novaJwt.accessToken);
    const dripIds = new Set(idsOf(dripVeh.body));
    const novaIds = new Set(idsOf(novaVeh.body));
    const novaVehicleIds = new Set(novaVehicles.map((v) => v.id));
    const dripVehicleIds = new Set(dripVehicles.map((v) => v.id));
    const dripLeak = [...dripIds].filter((id) => novaVehicleIds.has(id));
    const novaLeak = [...novaIds].filter((id) => dripVehicleIds.has(id));
    const novaOnly = novaVehicles.find((v) => !dripByVin.has(v.vin));
    const sharedVin = shared[0];
    const asDripNovaVin = novaOnly
      ? await apiGet(base, `/api/vehicles/${encodeURIComponent(novaOnly.vin)}`, dripJwt.accessToken)
      : { status: null, body: null };
    const asDripNovaUuid = novaOnly
      ? await apiGet(base, `/api/vehicles/${novaOnly.id}`, dripJwt.accessToken)
      : { status: null, body: null };
    const asDripShared = sharedVin
      ? await apiGet(base, `/api/vehicles/${encodeURIComponent(sharedVin)}`, dripJwt.accessToken)
      : { status: null, body: null };
    report.jwt.lists = {
      drip_vehicles: dripIds.size,
      nova_vehicles: novaIds.size,
      drip_customers: idsOf(dripCust.body).length,
      nova_customers: idsOf(novaCust.body).length,
      drip_deals: idsOf(dripDeals.body).length,
      nova_deals: idsOf(novaDeals.body).length,
      drip_leaked_nova_vehicle_ids: dripLeak,
      nova_leaked_drip_vehicle_ids: novaLeak,
    };
    report.jwt.single = {
      drip_on_nova_only_vin_status: asDripNovaVin.status,
      drip_on_nova_uuid_status: asDripNovaUuid.status,
      drip_on_shared_vin_id: asDripShared.body?.data?.id ?? null,
      drip_on_shared_vin_expected: sharedVin ? dripByVin.get(sharedVin)?.id : null,
    };
    if (dripLeak.length) fail("drip JWT leaked nova vehicles", dripLeak);
    if (novaLeak.length) fail("nova JWT leaked drip vehicles", novaLeak);
    if (asDripNovaVin.status && asDripNovaVin.status !== 404) {
      fail("drip GET nova-only VIN not 404", asDripNovaVin.status);
    }
    if (asDripNovaUuid.status && asDripNovaUuid.status !== 404) {
      fail("drip GET nova uuid not 404", asDripNovaUuid.status);
    }
    if (
      sharedVin &&
      asDripShared.body?.data?.id &&
      asDripShared.body.data.id !== dripByVin.get(sharedVin).id
    ) {
      fail("drip shared VIN resolved to wrong rooftop", asDripShared.body.data.id);
    }

    const pubDrip = await fetch(`${base}/api/vehicles/public?slug=${DRIP_SLUG}&limit=100`);
    const pubNova = await fetch(`${base}/api/vehicles/public?slug=${NOVA_SLUG}&limit=100`);
    const pubDripBody = await pubDrip.json().catch(() => ({}));
    const pubNovaBody = await pubNova.json().catch(() => ({}));
    const pubDripIds = new Set(idsOf(pubDripBody));
    const pubNovaIds = new Set(idsOf(pubNovaBody));
    const publicOverlap = [...pubDripIds].filter((id) => pubNovaIds.has(id));
    report.public_slugs = {
      drip_status: pubDrip.status,
      nova_status: pubNova.status,
      drip_count: pubDripIds.size,
      nova_count: pubNovaIds.size,
      overlapping_ids: publicOverlap,
    };
    if (publicOverlap.length) fail("public slug overlapping vehicle ids", publicOverlap);
  } else {
    fail("jwt sessions", { drip: dripJwt.error, nova: novaJwt.error });
  }

  const dripActive = dripVehicles.filter((v) => v.status === "Active").length;
  const dripSold = dripVehicles.filter((v) => v.status === "Sold").length;
  let httpOk = 0;
  let httpFail = 0;
  const httpFailures = [];
  const allDripUrls = dripVehicles.flatMap((v) => galleryHttpUrls(v.image_gallery));
  await Promise.all(
    allDripUrls.map(async (url, i) => {
      /* serialized via slice batches below */
      void i;
      void url;
    })
  );
  const batch = 8;
  for (let i = 0; i < allDripUrls.length; i += batch) {
    const slice = allDripUrls.slice(i, i + batch);
    const results = await Promise.all(slice.map(headOk));
    results.forEach((ok, j) => {
      if (ok) httpOk++;
      else {
        httpFail++;
        if (httpFailures.length < 10) httpFailures.push(slice[j]);
      }
    });
  }

  const expected = { vehicles: 72, images: 408, customers: 27, deals: 49, leads: 5, active: 23, sold: 49 };
  const live = {
    vehicles: rooftops[DRIP_ID].vehicles,
    images_http_200: httpOk,
    images_http_fail: httpFail,
    customers: rooftops[DRIP_ID].customers,
    deals: rooftops[DRIP_ID].deals,
    bos: rooftops[DRIP_ID].bos,
    leads: rooftops[DRIP_ID].leads,
    active: dripActive,
    sold: dripSold,
    mercedes_gallery: report.gallery.mercedes?.gallery ?? null,
  };
  report.completeness = {
    expected,
    live,
    match: {
      vehicles: live.vehicles === expected.vehicles,
      images: live.images_http_200 === expected.images && httpFail === 0,
      customers: live.customers === expected.customers,
      deals: live.deals === expected.deals && live.bos === expected.deals,
      leads: live.leads === expected.leads,
      active: live.active === expected.active,
      sold: live.sold === expected.sold,
      mercedes_zero: live.mercedes_gallery === 0,
    },
    http_failures: httpFailures,
  };
  for (const [k, passed] of Object.entries(report.completeness.match)) {
    if (!passed) fail(`completeness ${k}`, live);
  }

  const normByVin = new Map(normalized.vehicles.map((v) => [v.vin, v]));
  for (const vin of SPOT_VINS) {
    const src = normByVin.get(vin);
    const liveRow = dripByVin.get(vin);
    const srcFeat = src ? featureCount(src.features) : 0;
    const liveFeat = liveRow ? featureCount(liveRow.features) : 0;
    const srcPhotos = src?.images?.length ?? 0;
    const livePhotos = liveRow ? galleryHttpUrls(liveRow.image_gallery) : [];
    const row = {
      vin,
      present: Boolean(liveRow && src),
      year: src?.year === liveRow?.year,
      make: src?.make === liveRow?.make,
      model: src?.model === liveRow?.model,
      stock_number: src?.stock_number === liveRow?.stock_number,
      retail_price: Number(src?.retail_price) === Number(liveRow?.retail_price),
      special_price: Number(src?.special_price ?? 0) === Number(liveRow?.special_price ?? 0),
      description: (src?.description || "") === (liveRow?.description || ""),
      feature_count_src: srcFeat,
      feature_count_live: liveFeat,
      feature_count_match: srcFeat === liveFeat,
      photo_count_src: srcPhotos,
      photo_count_live: livePhotos.length,
      first_3_photos: livePhotos.slice(0, 3),
    };
    const keys = [
      "present",
      "year",
      "make",
      "model",
      "stock_number",
      "retail_price",
      "special_price",
      "description",
      "feature_count_match",
    ];
    row.ok = keys.every((k) => row[k] === true);
    if (vin === MERC_VIN) {
      row.ok = row.present && row.photo_count_live === 0 && liveRow?.status === "Sold";
    }
    if (!row.ok) fail("spot-check", vin);
    report.spot_check.push(row);
  }

  report.nova_untouched = {
    vehicles: rooftops[NOVA_ID].vehicles,
    customers: rooftops[NOVA_ID].customers,
    deals: rooftops[NOVA_ID].deals,
    leads: rooftops[NOVA_ID].leads,
    expected: { vehicles: 158, customers: 191, deals: 78, leads: 141 },
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outPath = path.join(OUT_DIR, "isolation-audit.json");
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ok: report.ok, out: outPath, failures: report.failures.length }, null, 2));
  if (!report.ok) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
