#!/usr/bin/env node
/**
 * Relocate Drip-only unprefixed `{vin}/` photos to `{dealership_id}/{vin}/`
 * and PATCH Drip galleries. Never writes Nova rows or Nova object prefixes.
 * Also renames the empty drip-motors-inc shell so it cannot be confused
 * with Hillz Drip.
 *
 *   node scripts/hillz-drip-import/relocate-drip-photos.mjs
 *   node scripts/hillz-drip-import/relocate-drip-photos.mjs --dry-run
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { loadEnv, PROJECT_URL, BUCKET, SCRIPT_ROOT } from "./lib/env.mjs";
import { parseGallery, serializeGallery } from "./lib/gallery.mjs";

const DRIP_ID = "4d43b08c-3d56-4b3f-b465-c8dd5d50e62e";
const NOVA_ID = "dd404bb6-3e64-43ae-9eb7-98095033c6cb";
const EMPTY_ID = "efe720c0-477e-45bf-a0a7-f6ebc1d984bd";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PUBLIC_MARKER = `/object/public/${BUCKET}/`;
const OUT_DIR = path.join(SCRIPT_ROOT, "out");

function argFlag(name) {
  return process.argv.includes(name);
}

function publicUrl(objectPath) {
  return `${PROJECT_URL}/storage/v1/object/public/${BUCKET}/${objectPath}`;
}

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

function rewriteUrl(url, fromPath, toPath) {
  return url.split(fromPath).join(toPath);
}

async function countEq(sb, table, col, id) {
  const { count, error } = await sb
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq(col, id);
  if (error) throw new Error(`${table}: ${error.message}`);
  return count ?? 0;
}

async function main() {
  const dryRun = argFlag("--dry-run");
  const env = loadEnv();
  if (!env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("missing service role");
  const sb = createClient(PROJECT_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { data: dripVehicles, error: dripErr } = await sb
    .from("vehicles")
    .select("id, vin, dealership_id, image_gallery")
    .eq("dealership_id", DRIP_ID);
  if (dripErr) throw new Error(dripErr.message);

  const { data: novaVins, error: novaErr } = await sb
    .from("vehicles")
    .select("vin")
    .eq("dealership_id", NOVA_ID);
  if (novaErr) throw new Error(novaErr.message);
  const novaVinSet = new Set((novaVins || []).map((r) => r.vin));

  const novaBefore = {
    vehicles: await countEq(sb, "vehicles", "dealership_id", NOVA_ID),
    customers: await countEq(sb, "customers", "dealership_id", NOVA_ID),
    deals: await countEq(sb, "sales_deals", "dealership_id", NOVA_ID),
    leads: await countEq(sb, "leads", "dealership_id", NOVA_ID),
  };

  const stats = {
    dryRun,
    vehicles_scanned: (dripVehicles || []).length,
    galleries_patched: 0,
    copied: 0,
    already_prefixed: 0,
    skipped_nova_prefix: 0,
    deleted_unprefixed: 0,
    failed: [],
    nova_before: novaBefore,
    nova_after: null,
    empty_clone: null,
  };

  const deleteCandidates = [];

  for (const v of dripVehicles || []) {
    if (v.dealership_id !== DRIP_ID) continue;
    const parsed = parseGallery(v.image_gallery);
    if (!parsed.length) continue;
    let changed = false;
    const next = parsed.map((img) => ({ ...img }));
    for (const img of next) {
      const objectPath = bucketPathFromUrl(img.url);
      if (!objectPath) continue;
      if (objectPath.startsWith(`${DRIP_ID}/`)) {
        stats.already_prefixed++;
        continue;
      }
      if (objectPath.startsWith(`${NOVA_ID}/`)) {
        stats.skipped_nova_prefix++;
        stats.failed.push({ vin: v.vin, error: "gallery pointed at Nova prefix" });
        continue;
      }
      const firstSeg = objectPath.split("/")[0];
      if (UUID_RE.test(firstSeg) && firstSeg !== DRIP_ID) {
        stats.failed.push({ vin: v.vin, error: `foreign prefix ${firstSeg}` });
        continue;
      }
      const destPath = `${DRIP_ID}/${objectPath}`;
      if (!dryRun) {
        const copied = await sb.storage.from(BUCKET).copy(objectPath, destPath);
        if (copied.error && !/already exists|duplicate|409/i.test(copied.error.message || "")) {
          const dl = await sb.storage.from(BUCKET).download(objectPath);
          if (dl.error) {
            stats.failed.push({ vin: v.vin, path: objectPath, error: copied.error.message });
            continue;
          }
          const buf = Buffer.from(await dl.data.arrayBuffer());
          const up = await sb.storage.from(BUCKET).upload(destPath, buf, {
            contentType: "image/jpeg",
            upsert: true,
          });
          if (up.error) {
            stats.failed.push({ vin: v.vin, path: destPath, error: up.error.message });
            continue;
          }
        }
      }
      stats.copied++;
      img.url = rewriteUrl(img.url, objectPath, destPath);
      changed = true;
      if (!novaVinSet.has(v.vin) && !UUID_RE.test(firstSeg)) {
        deleteCandidates.push(objectPath);
      }
    }
    if (changed) {
      if (!dryRun) {
        const { error } = await sb
          .from("vehicles")
          .update({ image_gallery: serializeGallery(next) })
          .eq("id", v.id)
          .eq("dealership_id", DRIP_ID);
        if (error) {
          stats.failed.push({ vin: v.vin, error: `patch: ${error.message}` });
          continue;
        }
      }
      stats.galleries_patched++;
    }
  }

  if (!dryRun) {
    const uniqueDeletes = [...new Set(deleteCandidates)];
    for (const objectPath of uniqueDeletes) {
      if (objectPath.startsWith(`${NOVA_ID}/`)) continue;
      if (objectPath.startsWith(`${DRIP_ID}/`)) continue;
      const { error } = await sb.storage.from(BUCKET).remove([objectPath]);
      if (error) {
        stats.failed.push({ path: objectPath, error: `delete: ${error.message}` });
      } else {
        stats.deleted_unprefixed++;
      }
    }
  }

  const { data: shell } = await sb
    .from("dealerships")
    .select("id, name, slug")
    .eq("id", EMPTY_ID)
    .maybeSingle();
  stats.empty_clone_before = shell;
  if (shell && (shell.slug === "drip-motors-inc" || /drip motors inc/i.test(shell.name || ""))) {
    if (!dryRun) {
      const { data: updated, error } = await sb
        .from("dealerships")
        .update({ name: "Gavy – unused", slug: "archived-drip-shell" })
        .eq("id", EMPTY_ID)
        .select("id, name, slug")
        .maybeSingle();
      if (error) stats.failed.push({ error: `rename shell: ${error.message}` });
      stats.empty_clone = updated;
    } else {
      stats.empty_clone = { would_rename: true, from: shell };
    }
  } else {
    stats.empty_clone = shell;
  }

  stats.nova_after = {
    vehicles: await countEq(sb, "vehicles", "dealership_id", NOVA_ID),
    customers: await countEq(sb, "customers", "dealership_id", NOVA_ID),
    deals: await countEq(sb, "sales_deals", "dealership_id", NOVA_ID),
    leads: await countEq(sb, "leads", "dealership_id", NOVA_ID),
  };
  if (
    stats.nova_after.vehicles !== 158 ||
    stats.nova_after.customers !== 191 ||
    stats.nova_after.deals !== 78 ||
    stats.nova_after.leads !== 141
  ) {
    throw new Error(`Nova counts changed: ${JSON.stringify(stats.nova_after)}`);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outPath = path.join(OUT_DIR, "relocate-drip-photos.json");
  fs.writeFileSync(outPath, JSON.stringify(stats, null, 2));
  console.log(
    JSON.stringify(
      {
        ok: stats.failed.length === 0,
        dryRun,
        copied: stats.copied,
        patched: stats.galleries_patched,
        deleted_unprefixed: stats.deleted_unprefixed,
        failed: stats.failed.length,
        empty_clone: stats.empty_clone?.name || stats.empty_clone?.would_rename || stats.empty_clone?.slug,
        nova: stats.nova_after,
        out: outPath,
      },
      null,
      2
    )
  );
  if (stats.failed.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
