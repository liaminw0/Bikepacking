import { getNextcloudConfig, jsonResponse, verifyRequest } from "./auth.mjs";

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB guardrail

const basicAuthHeaders = (cfg) => ({
  Authorization: `Basic ${Buffer.from(`${cfg.username}:${cfg.password}`).toString("base64")}`,
});

const buildTargetUrl = (cfg, fileName = "") => {
  const base = cfg.baseUrl.replace(/\/+$/, "");
  const folder = cfg.folder ? `/${cfg.folder.replace(/^\/+|\/+$/g, "")}` : "";
  const suffix = fileName ? `/${encodeURIComponent(fileName)}` : "/";
  return `${base}${folder}${suffix}`;
};

const buildPublicUrl = (cfg, fileName) => {
  const base = (cfg.publicBaseUrl || cfg.baseUrl || "").replace(/\/+$/, "");
  if (!base) throw new Error("Missing public URL base");
  const folder = cfg.folder ? `/${cfg.folder.replace(/^\/+|\/+$/g, "")}` : "";
  return `${base}${folder}/${encodeURIComponent(fileName)}`;
};

const sanitizeNameToWebp = (name = "") => {
  const parts = name.split(".");
  parts.pop(); // drop original extension
  const base = parts.join(".") || "image";
  const safeBase = base.replace(/[^a-z0-9-_]/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return `${safeBase || "image"}.webp`;
};

const sanitizeNamePreserveExt = (name = "") => {
  const parts = name.split(".");
  const ext = parts.length > 1 ? `.${parts.pop()}` : ".png";
  const base = parts.join(".") || "image";
  const safeBase = base.replace(/[^a-z0-9-_]/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return `${safeBase || "image"}${ext}`;
};

export const handler = async (event) => {
  const auth = verifyRequest(event);
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

  let buffer;
  try {
    buffer = Buffer.from(data, "base64");
  } catch {
    return jsonResponse(400, { error: "Invalid image data" });
  }
  if (buffer.length > MAX_IMAGE_SIZE) {
    return jsonResponse(400, { error: "Image too large (max 10MB)" });
  }

  let fileName = sanitizeNameToWebp(name);

  try {
    let uploadBuffer = buffer;
    let uploadType = "application/octet-stream";

    try {
      const sharp = (await import("sharp")).default;
      uploadBuffer = await sharp(buffer).rotate().webp({ quality: 82 }).toBuffer();
      uploadType = "image/webp";
      fileName = sanitizeNameToWebp(name);
    } catch (err) {
      console.error("Sharp conversion failed, uploading original", err);
      uploadBuffer = buffer;
      uploadType = contentType?.startsWith("image/") ? contentType : "application/octet-stream";
      fileName = sanitizeNamePreserveExt(name);
    }

    const putUrl = buildTargetUrl(cfg, fileName);
    const res = await fetch(putUrl, {
      method: "PUT",
      headers: {
        ...basicAuthHeaders(cfg),
        "Content-Type": uploadType,
      },
      body: uploadBuffer,
    });
    const body = await res.text();
    if (!res.ok) {
      console.error("Nextcloud upload failed", res.status, body);
      const status = res.status === 401 ? 502 : 500;
      return jsonResponse(status, { error: `Upload failed (${res.status})` });
    }
    let publicUrl;
    try {
      publicUrl = buildPublicUrl(cfg, fileName);
    } catch (e) {
      console.error("Public URL build failed", e);
      return jsonResponse(500, { error: "Upload ok but public URL missing" });
    }
    return jsonResponse(200, { ok: true, url: publicUrl, name: fileName });
  } catch (err) {
    console.error("Upload handler error", err);
    return jsonResponse(500, { error: err?.message || "Failed to upload image" });
  }
};
