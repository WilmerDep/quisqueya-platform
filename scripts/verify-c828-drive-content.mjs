/**
 * C8.28-J — verify actual WebP bytes through the locally configured Drive OAuth.
 * READ ONLY: requests OAuth token and downloads original bytes in memory.
 * No files written; no MySQL changes; no uploads; no tokens in output.
 * Run: node scripts/verify-c828-drive-content.mjs
 */
import dotenv from "dotenv";
import { readFileSync } from "node:fs";

dotenv.config({ path: ".env", quiet: true });

const doc = JSON.parse(readFileSync(new URL("../audits/c828-city-tour-drive-verification.json", import.meta.url), "utf8"));
const manifest = JSON.parse(readFileSync(new URL("../audits/c828-city-tour-media-manifest.json", import.meta.url), "utf8"));
const environment = {
  provider: process.env.STORAGE_PROVIDER?.trim(),
  client: process.env.GOOGLE_DRIVE_CLIENT_ID?.trim(),
  secret: process.env.GOOGLE_DRIVE_CLIENT_SECRET?.trim(),
  refresh: process.env.GOOGLE_DRIVE_REFRESH_TOKEN?.trim(),
  root: process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID?.trim(),
};
const report = (tag, payload) => console.log(tag + "=" + JSON.stringify(payload));

async function main() {
  if (environment.provider !== "google-drive" || !environment.client || !environment.secret || !environment.refresh || !environment.root) {
    throw Object.assign(new Error("Google Drive config unavailable"), { code: "CONFIG_NOT_READY" });
  }
  if (doc.assets.length !== 15 || doc.verifiedCount !== 15 ||
    manifest.cityTour.length !== 15 ||
    doc.assets.some(x => x.mimeType !== "image/webp" || x.sizeBytes <= 0) ||
    doc.assets.some(x => !manifest.cityTour.find(y => y.storageKey === x.storageKey))) {
    throw Object.assign(new Error("City Tour evidence inconsistent"), { code: "MANIFEST_INTEGRITY" });
  }

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: environment.client,
      client_secret: environment.secret,
      refresh_token: environment.refresh,
    }),
    signal: AbortSignal.timeout(15000),
  });
  const token = await tokenResponse.json().catch(() => ({}));
  if (!tokenResponse.ok || !token.access_token) {
    report("OAUTH_REFRESH", { ok: false, httpStatus: tokenResponse.status, errorCode: String(token.error || "TOKEN_UNAVAILABLE") });
    process.exitCode = 1;
    return;
  }
  report("OAUTH_REFRESH", { ok: true });

  let ok = 0;
  let totalBytes = 0;
  for (const asset of doc.assets) {
    try {
      const url = "https://www.googleapis.com/drive/v3/files/" +
        encodeURIComponent(asset.storageKey) + "?alt=media&supportsAllDrives=true";
      const response = await fetch(url, {
        headers: { Authorization: "Bearer " + token.access_token },
        signal: AbortSignal.timeout(20000),
      });
      if (!response.ok) {
        report("CONTENT_CHECK", { label: asset.label, verified: false, errorCode: "HTTP_" + response.status });
        continue;
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      const signatureOk = bytes.length >= 12 &&
        bytes.toString("ascii", 0, 4) === "RIFF" &&
        bytes.toString("ascii", 8, 12) === "WEBP";
      const sizeOk = bytes.length === asset.sizeBytes;
      const verified = signatureOk && sizeOk;
      if (verified) { ok += 1; totalBytes += bytes.length; }
      report("CONTENT_CHECK", { label: asset.label, verified, signatureOk, sizeOk });
    } catch (error) {
      report("CONTENT_CHECK", { label: asset.label, verified: false, errorCode: String(error?.code || error?.name || "READ_FAILED") });
    }
  }
  report("C8_28_J_SUMMARY", { verified: ok, total: doc.assets.length, verifiedBytes: totalBytes });
  report("C8_28_J", ok === doc.assets.length ? "READ_ONLY_APPROVED" : "BLOCKED");
  if (ok !== doc.assets.length) process.exitCode = 1;
}

try { await main(); }
catch (error) {
  report("C8_28_J", "FAILED");
  report("ERROR_CODE", String(error?.code || error?.name || "UNEXPECTED"));
  process.exitCode = 1;
} finally {
  console.log("DRIVE=NOT_MODIFIED");
  console.log("MYSQL=NOT_MODIFIED");
  console.log("STAGING=NOT_MODIFIED");
  console.log("TOKENS=NOT_PRINTED");
}
