import {
  basicAuthHeader,
  decodeBase64ToBytes,
  getNextcloudConfig,
  jsonResponse,
  verifyRequest,
} from "../_lib/auth.js";
import { createPagesHandler } from "../_lib/pages-adapter.js";

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

const basicAuthHeaders = (cfg) => ({
  Authorization: basicAuthHeader(cfg.username, cfg.password),
});

const buildTargetUrl = (cfg, fileName = "") => {
  const base = cfg.baseUrl.replace(/\/+$/, "");
  const folder = cfg.folder ? `/${cfg.folder.replace(/^\/+|\/+$/g, "")}` : "";
  const suffix = fileName ? `/${encodeURIComponent(fileName)}` : "/";
  return `${base}${folder}${suffix}`;
};

const buildPublicUrl = (cfg, fileName) => {
  const base = (cfg.publicBaseUrl || cfg.baseUrl || "").replace(/\/+$/, "");
  const folder = cfg.folder ? `/${cfg.folder.replace(/^\/+|\/+$/g, "")}` : "";
  return `${base}${folder}/${encodeURIComponent(fileName)}`;
};

const sanitizeName = (name = "") => {
  const parts = name.split(".");
  const ext = parts.length > 1 ? `.${parts.pop().toLowerCase()}` : ".jpg";
  const base = parts.join(".") || "image";
  const safeBase = base.replace(/[^a-z0-9-_]/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return `${safeBase || "image"}${ext}`;
};

const isImageType = (contentType = "") => contentType.startsWith("image/");

async function uploadToNextcloud(url, buffer, cfg, contentType) {
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
    return {
      ok: false,
      status,
      detail: typeof body === "string" ? body.slice(0, 200) : "",
    };
  }

  return { ok: true };
}

async function handler(event) {
  const auth = await verifyRequest(event);
  if (!auth.ok) return auth.response;
  if (event.httpMethod !== "POST") return jsonResponse(405, { error: "Method not allowed" });

  let cfg;
  try {
    cfg = getNextcloudConfig();
  } catch (err) {
    console.error("Nextcloud config error", err);
    return jsonResponse(500, { error: "Nextcloud not configured" });
  }
  if (!cfg) return jsonResponse(500, { error: "Nextcloud not configured" });

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return jsonResponse(400, { error: "Invalid JSON" });
  }

  const { name, data, contentType } = payload || {};
  if (!data) return jsonResponse(400, { error: "Image data required" });
  if (!isImageType(contentType)) return jsonResponse(400, { error: "Images only" });

  let buffer;
  try {
    buffer = decodeBase64ToBytes(data);
  } catch {
    return jsonResponse(400, { error: "Invalid image data" });
  }

  if (buffer.byteLength > MAX_IMAGE_SIZE) {
    return jsonResponse(400, { error: "Image too large (max 10MB)" });
  }

  const fileName = sanitizeName(name);
  const targetUrl = buildTargetUrl(cfg, fileName);

  try {
    const upload = await uploadToNextcloud(targetUrl, buffer, cfg, contentType || "application/octet-stream");
    if (!upload.ok) {
      return jsonResponse(upload.status, {
        error: `Nextcloud upload failed (${upload.status})`,
        detail: upload.detail,
      });
    }

    return jsonResponse(200, {
      ok: true,
      url: buildPublicUrl(cfg, fileName),
      name: fileName,
    });
  } catch (err) {
    console.error("Upload handler error", err);
    return jsonResponse(500, { error: err?.message || "Failed to upload image" });
  }
}

export const onRequest = createPagesHandler(handler);
