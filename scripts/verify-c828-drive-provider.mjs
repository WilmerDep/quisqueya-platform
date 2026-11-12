/**
 * C8.28-I: read-only Google Drive API access and ancestry verification.
 * Run at repository root: node scripts/verify-c828-drive-provider.mjs
 * Uses the same OAuth refresh-token settings as GoogleDriveService.
 * Does not register media, mutate Drive/DB, or print tokens and secrets.
 */
import dotenv from "dotenv";
import { readFileSync } from "node:fs";

dotenv.config({ path: ".env", quiet: true });

const manifest = JSON.parse(readFileSync(new URL("../audits/c828-city-tour-drive-verification.json", import.meta.url), "utf8"));
const root = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID?.trim();
const config = {
  provider: process.env.STORAGE_PROVIDER?.trim(),
  id: process.env.GOOGLE_DRIVE_CLIENT_ID?.trim(),
  secret: process.env.GOOGLE_DRIVE_CLIENT_SECRET?.trim(),
  refresh: process.env.GOOGLE_DRIVE_REFRESH_TOKEN?.trim(),
};
const output = (name, data) => console.log(name + "=" + JSON.stringify(data));
const rootApi = "https://www.googleapis.com/drive/v3/files/";

async function run() {
  if (config.provider !== "google-drive" || !config.id || !config.secret || !config.refresh || !root) {
    output("C8_28_I", "CONFIG_INCOMPLETE"); process.exitCode = 1; return;
  }
  if (manifest.assets.length !== 15 || new Set(manifest.assets.map(x=>x.storageKey)).size !== 15) {
    output("C8_28_I", "INVALID_MANIFEST"); process.exitCode = 1; return;
  }
  const auth = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.id,
      client_secret: config.secret,
      refresh_token: config.refresh,
      grant_type: "refresh_token",
    }),
    signal: AbortSignal.timeout(12000),
  });
  const tokens = await auth.json().catch(() => ({}));
  if (!auth.ok || !tokens.access_token) {
    output("OAUTH_REFRESH", { ok: false, httpStatus: auth.status, errorCode: tokens.error || "TOKEN_UNAVAILABLE" });
    output("C8_28_I", "BLOCKED"); process.exitCode = 1; return;
  }
  output("OAUTH_REFRESH", { ok: true });
  const cached = new Map();
  async function metadata(id) {
    if (cached.has(id)) return cached.get(id);
    const url = rootApi + encodeURIComponent(id) + "?fields=id,name,mimeType,size,parents,trashed&supportsAllDrives=true";
    const response = await fetch(url, { headers: { Authorization: "Bearer " + tokens.access_token }, signal: AbortSignal.timeout(12000) });
    if (!response.ok) {
      const err = new Error("DRIVE_METADATA_HTTP_" + response.status);
      err.code = "DRIVE_METADATA_HTTP_" + response.status;
      throw err;
    }
    const value = await response.json();
    cached.set(id, value);
    return value;
  }
  async function withinRoot(fileId) {
    const pending = [fileId], seen = new Set();
    while (pending.length) {
      const id = pending.shift();
      if (!id || seen.has(id)) continue;
      if (id === root) return true;
      if (seen.size >= 128) return false;
      seen.add(id);
      const info = await metadata(id);
      pending.push(...(info.parents || []));
    }
    return false;
  }
  const results = [];
  for (const asset of manifest.assets) {
    try {
      const actual = await metadata(asset.storageKey);
      const rootOk = await withinRoot(asset.storageKey);
      results.push({
        label: asset.label,
        verified: Boolean(rootOk && !actual.trashed && actual.mimeType === "image/webp" &&
          actual.name === asset.name && Number(actual.size) === asset.sizeBytes),
        rootOk,
        mimeOk: actual.mimeType === "image/webp",
        nameOk: actual.name === asset.name,
        sizeOk: Number(actual.size) === asset.sizeBytes,
        notTrashed: !actual.trashed,
      });
    } catch (error) {
      results.push({ label: asset.label, verified: false, errorCode: String(error.code || error.name || "UNKNOWN") });
    }
  }
  for (const result of results) output("FILE_CHECK", result);
  const verified = results.filter(x => x.verified).length;
  output("C8_28_I_SUMMARY", { verified, total: manifest.assets.length, configRootAccessible: results.some(x=>x.rootOk) });
  const passed = verified === manifest.assets.length;
  output("C8_28_I", passed ? "READ_ONLY_APPROVED" : "BLOCKED");
  if (!passed) process.exitCode = 1;
}
try {
  await run();
} catch (error) {
  output("C8_28_I", "FAILED");
  output("ERROR_CODE", String(error.code || error.name || "UNKNOWN"));
  process.exitCode = 1;
}
console.log("CREDENTIALS=NOT_PRINTED");
console.log("DRIVE=NOT_MODIFIED");
console.log("MYSQL=NOT_MODIFIED");
console.log("STAGING=NOT_MODIFIED");
