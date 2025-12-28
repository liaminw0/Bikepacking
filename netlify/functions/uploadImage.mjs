import { getNextcloudConfig, jsonResponse, verifyRequest } from "./auth.mjs";

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB guardrail

const log = (stage, detail = "") => {
  console.error(`[uploadImage] ${stage}${detail ? `: ${detail}` : ""}`);
};

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
  const folder = cfg.folder ? `/${cfg.folder.replace(/^\/+|\/+$/g, "")}` : "";
  return `${base}${folder}/${encodeURIComponent(fileName)}`;
};

const sanitizeName = (name = "") => {
  const parts = name.split(".");
  const ext = parts.length > 1 ? `.${parts.pop()}` : "";
  const base = parts.join(".") || "image";
  const safeBase = base.replace(/[^a-z0-9-_]/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return `${safeBase || "image"}${ext || ".png"}`;
};

export const handler = async (event) => {
  const auth = verifyRequest(event);
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

  const fileName = sanitizeName(name);
  const targetUrl = buildTargetUrl(cfg, fileName);
  log("target", targetUrl);

  try {
    const res = await fetch(targetUrl, {
      method: "PUT",
      headers: {
        ...basicAuthHeaders(cfg),
        "Content-Type": contentType?.startsWith("image/") ? contentType : "application/octet-stream",
      },
      body: buffer,
    });
    const body = await res.text();
    if (!res.ok) {
      console.error("Nextcloud upload failed", res.status, body);
      const status = res.status === 401 ? 502 : 500;
      return jsonResponse(status, { error: "Failed to upload image" });
    }
    const publicUrl = buildPublicUrl(cfg, fileName);
    return jsonResponse(200, { ok: true, url: publicUrl, name: fileName });
  } catch (err) {
    console.error(err);
    return jsonResponse(500, { error: err?.message || "Failed to upload image" });
  }
};
