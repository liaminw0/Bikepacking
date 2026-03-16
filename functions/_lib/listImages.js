import { basicAuthHeader, getNextcloudConfig, jsonResponse, verifyRequest } from "./auth.js";

const MAX_ITEMS = 200;

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
  const base = cfg.publicBaseUrl.replace(/\/+$/, "");
  const folder = cfg.folder ? `/${cfg.folder.replace(/^\/+|\/+$/g, "")}` : "";
  return `${base}${folder}/${encodeURIComponent(fileName)}`;
};

const decodeEntities = (value = "") =>
  value.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

const parsePropfind = (xml, cfg) => {
  const responses = xml.match(/<d:response[\s\S]*?<\/d:response>/gi) || [];
  const items = [];
  responses.forEach((resp) => {
    const hrefMatch = resp.match(/<d:href>([^<]+)<\/d:href>/i);
    if (!hrefMatch) return;
    const rawHref = decodeEntities(hrefMatch[1]);
    const decodedHref = decodeURIComponent(rawHref);
    if (decodedHref.endsWith("/")) return;
    const typeMatch = resp.match(/<d:getcontenttype>([^<]+)<\/d:getcontenttype>/i);
    const contentType = (typeMatch?.[1] || "").toLowerCase();
    if (contentType && !contentType.startsWith("image/")) return;
    const name = decodedHref.split("/").filter(Boolean).pop();
    if (!name) return;
    const sizeMatch = resp.match(/<d:getcontentlength>([^<]+)<\/d:getcontentlength>/i);
    const modifiedMatch = resp.match(/<d:getlastmodified>([^<]+)<\/d:getlastmodified>/i);
    items.push({
      name,
      url: buildPublicUrl(cfg, name),
      size: sizeMatch ? Number(sizeMatch[1]) || null : null,
      lastModified: modifiedMatch ? new Date(modifiedMatch[1]).toISOString() : null,
    });
  });
  return items
    .sort((a, b) => {
      const aTime = a.lastModified ? new Date(a.lastModified).getTime() : 0;
      const bTime = b.lastModified ? new Date(b.lastModified).getTime() : 0;
      if (aTime !== bTime) return bTime - aTime;
      return (b.name || "").localeCompare(a.name || "");
    })
    .slice(0, MAX_ITEMS);
};

export async function handler(event) {
  const auth = await verifyRequest(event);
  if (!auth.ok) return auth.response;
  if (event.httpMethod !== "GET") return jsonResponse(405, { error: "Method not allowed" });
  let cfg;
  try {
    cfg = getNextcloudConfig();
  } catch (err) {
    console.error("Nextcloud config error", err);
    return jsonResponse(500, { error: "Nextcloud not configured" });
  }
  if (!cfg) return jsonResponse(500, { error: "Nextcloud not configured" });
  try {
    const res = await fetch(buildTargetUrl(cfg), {
      method: "PROPFIND",
      headers: {
        Depth: "1",
        ...basicAuthHeaders(cfg),
      },
    });
    const body = await res.text();
    if (!res.ok) {
      console.error("Nextcloud list failed", res.status, body);
      const status = res.status === 401 ? 502 : 500;
      return jsonResponse(status, { error: "Failed to load images" });
    }
    const items = parsePropfind(body, cfg);
    return jsonResponse(200, { items });
  } catch (err) {
    console.error(err);
    return jsonResponse(500, { error: "Failed to list images" });
  }
}
