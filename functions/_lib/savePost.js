import { encodeRepoContent, enforceContentPath, getEnv, githubRequest, jsonResponse, verifyRequest } from "./auth.js";

export async function handler(event) {
  const auth = await verifyRequest(event);
  if (!auth.ok) return auth.response;
  if (event.httpMethod !== "POST") return jsonResponse(405, { error: "Method not allowed" });
  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return jsonResponse(400, { error: "Invalid JSON" });
  }
  const { path: rawPath, content, message, sha } = body;
  if (!rawPath || !content) return jsonResponse(400, { error: "Path and content required" });
  const env = getEnv();
  const path = enforceContentPath(rawPath, env);
  const payload = {
    message: message || `Update ${path}`,
    content: encodeRepoContent(content),
    branch: env.github.branch,
  };
  if (sha) payload.sha = sha;
  try {
    const res = await githubRequest(env, `/contents/${path}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) return jsonResponse(res.status, { error: data?.message || "GitHub error" });
    return jsonResponse(200, { ok: true, path: data.content?.path, sha: data.content?.sha });
  } catch (err) {
    console.error(err);
    return jsonResponse(500, { error: "Failed to save post" });
  }
}
