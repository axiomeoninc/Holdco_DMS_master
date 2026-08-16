#!/usr/bin/env node
/**
 * Extract hillz-migration_FINAL.zip into /tmp/hillz-drip (or --dest).
 */
import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ZIP_DEFAULT = "/home/dave/Documents/DRIPDATA/hillz-migration_FINAL.zip";
const DEST_DEFAULT = "/tmp/hillz-drip";

export function extractZip({ zip = ZIP_DEFAULT, dest = DEST_DEFAULT } = {}) {
  if (!fs.existsSync(zip)) {
    throw new Error(`Zip not found: ${zip}`);
  }
  fs.mkdirSync(dest, { recursive: true });
  const marker = path.join(dest, "hillz-migration", "data", "07_customers.json");
  const imgMarker = path.join(dest, "hillz-migration", "data", "images");
  if (fs.existsSync(marker) && fs.existsSync(imgMarker)) {
    const jpg = countJpgs(imgMarker);
    if (jpg >= 400) {
      return { dest, skipped: true, jpg };
    }
  }
  const r = spawnSync("unzip", ["-qo", zip, "-d", dest], { stdio: "inherit" });
  if (r.status !== 0) {
    throw new Error(`unzip failed with status ${r.status}`);
  }
  return { dest, skipped: false, jpg: countJpgs(path.join(dest, "hillz-migration", "data", "images")) };
}

function countJpgs(dir) {
  if (!fs.existsSync(dir)) return 0;
  let n = 0;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (!fs.statSync(p).isDirectory()) continue;
    n += fs.readdirSync(p).filter((f) => f.toLowerCase().endsWith(".jpg")).length;
  }
  return n;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const destIdx = process.argv.indexOf("--dest");
  const zipIdx = process.argv.indexOf("--zip");
  const dest = destIdx >= 0 ? process.argv[destIdx + 1] : DEST_DEFAULT;
  const zip = zipIdx >= 0 ? process.argv[zipIdx + 1] : ZIP_DEFAULT;
  const result = extractZip({ zip, dest });
  console.log(JSON.stringify(result, null, 2));
}
