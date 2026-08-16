import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const SCRIPT_ROOT = path.resolve(__dirname, "..");
export const DMS_ROOT = path.resolve(SCRIPT_ROOT, "../..");

export function loadEnv() {
  const envPath = path.join(DMS_ROOT, ".env.local");
  const raw = fs.readFileSync(envPath, "utf8");
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const i = line.indexOf("=");
    const key = line.slice(0, i).trim();
    let val = line.slice(i + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

export const PROJECT_REF = "zwfeitodxikdwymkieai";
export const PROJECT_URL = `https://${PROJECT_REF}.supabase.co`;
export const BUCKET = "vehicles";
export const DEALERSHIP_SLUG = "drip-motors";
export const DEALERSHIP_NAME = "Drip Motors Inc";
export const SOURCE_TAG = "hillz-drip-1558";
export const TZ = "America/Vancouver";
