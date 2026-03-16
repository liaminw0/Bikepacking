import sharp from "sharp";
import { getNextcloudConfig, jsonResponse, verifyRequest } from "./auth.mjs";

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB guardrail
const WEBP_QUALITY = 82;

const log = (stage, detail = "") => {
  console.error(`[uploadImage] ${stage}${detail ? `: ${detail}` : ""}`);
};

const basicAuthHeaders = (cfg) => ({
  Authorization: `Basic ${Buffer.from(`${cfg.username}:${cfg.password}`).toString("base64")}`,
});

const buildTargetUrl = (cfg, fileName = "", subfolder = "") => {
  const base = cfg.baseUrl.replace(/\/+$/, "");
  const folder = cfg.folder ? `/${cfg.folder.replace(/^\/+|\/+$/g, "")}` : "";
  const extra = subfolder ? `/${subfolder.replace(/^\/+|\/+$/g, "")}` : "";
  const suffix = fileName ? `/${encodeURIComponent(fileName)}` : "/";
  return `${base}${folder}${extra}${suffix}`;
};

const buildPublicUrl = (cfg, fileName, subfolder = "") => {
  const base = (cfg.publicBaseUrl || cfg.baseUrl || "").replace(/\/+$/, "");
  const folder = cfg.folder ? `/${cfg.folder.replace(/^\/+|\/+$/g, "")}` : "";
  const extra = subfolder ? `/${subfolder.replace(/^\/+|\/+$/g, "")}` : "";
  return `${base}${folder}${extra}/${encodeURIComponent(fileName)}`;
};

const sanitizeName = (name = "", extOverride = "") => {
  const parts = name.split(".");
  const ext = extOverride || (parts.length > 1 ? `.${parts.pop()}` : "");
  const base = parts.join(".") || "image";
  const safeBase = base.replace(/[^a-z0-9-_]/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return `${safeBase || "image"}${ext || ".png"}`;
};

const convertToWebp = async (buffer) => {
  try {
    const webpBuffer = await sharp(buffer, { failOn: "none" }).rotate().webp({ quality: WEBP_QUALITY }).toBuffer();
    return webpBuffer;
  } catch (err) {
    log("convert error", err?.message);
    throw new Error("Invalid or unsupported image");
  }
};

const uploadToNextcloud = async (url, buffer, cfg, contentType) => {
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      ...basicAuthHeaders(cfg),
      "Content-Type": contentType,
    },
    body: buffer,
  });
  const body = await res.text();
  if (!res.ok) {
    console.error("Nextcloud upload failed", res.status, body);
    const status = res.status === 401 ? 502 : 500;
    const snippet = typeof body === "string" ? body.slice(0, 200) : "";
    return { ok: false, status, detail: snippet };
  }
  return { ok: true };
};

export const handler = async (event) => {
  const auth = await verifyRequest(event);
  if (!auth.ok) return auth.response;
  if (event.httpMethod !== "POST") return jsonResponse(405, { error: "Method not allowed" });
  log("start");

  let cfg;
  try {
    cfg = getNextcloudConfig();
  } catch (err) {
    console.error("Nextcloud config error", err);
    return jsonResponse(500, { error: "Nextcloud not configured" });
  }
  if (!cfg) return jsonResponse(500, { error: "Nextcloud not configured" });
  log("config ok", `base=${cfg.baseUrl}, public=${cfg.publicBaseUrl || cfg.baseUrl}`);

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return jsonResponse(400, { error: "Invalid JSON" });
  }
  const { name, data, contentType } = payload || {};
  if (!data) return jsonResponse(400, { error: "Image data required" });
  log("payload", `name=${name || "unnamed"}, type=${contentType || "unknown"}`);

  let buffer;
  try {
    buffer = Buffer.from(data, "base64");
  } catch {
    return jsonResponse(400, { error: "Invalid image data" });
  }
  if (buffer.length > MAX_IMAGE_SIZE) {
    return jsonResponse(400, { error: "Image too large (max 10MB)" });
  }
  log("buffer size", `${buffer.length} bytes`);

  if (!contentType?.startsWith("image/")) {
    return jsonResponse(400, { error: "Images only" });
  }

  let processedBuffer;
  try {
    processedBuffer = await convertToWebp(buffer);
    log("processed size", `${processedBuffer.length} bytes`);
  } catch (err) {
    return jsonResponse(400, { error: err.message || "Unable to process image" });
  }
  if (processedBuffer.length > MAX_IMAGE_SIZE) {
    return jsonResponse(400, { error: "Image too large after processing" });
  }

  const webpName = sanitizeName(name, ".webp");
  const webpUrl = buildTargetUrl(cfg, webpName);
  const originalName = sanitizeName(name);
  const originalUrl = buildTargetUrl(cfg, originalName, "Originals");
  log("target webp", webpUrl);
  log("target original", originalUrl);

  try {
    const webpUpload = await uploadToNextcloud(webpUrl, processedBuffer, cfg, "image/webp");
    if (!webpUpload.ok) {
      return jsonResponse(webpUpload.status, {
        error: `Nextcloud upload failed (${webpUpload.status})`,
        detail: webpUpload.detail,
      });
    }

    // Sequentially upload original to avoid parallel bandwidth spikes.
    const originalContentType = contentType || "application/octet-stream";
    const originalUpload = await uploadToNextcloud(originalUrl, buffer, cfg, originalContentType);
    if (!originalUpload.ok) {
      return jsonResponse(originalUpload.status, {
        error: `Original upload failed (${originalUpload.status})`,
        detail: originalUpload.detail,
      });
    }

    const publicUrl = buildPublicUrl(cfg, webpName);
    return jsonResponse(200, { ok: true, url: publicUrl, name: webpName });
  } catch (err) {
    console.error("Upload handler error", err);
    return jsonResponse(500, { error: err?.message || "Failed to upload image" });
  }
};
