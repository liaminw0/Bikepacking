import { enforceContentPath, getEnv, githubRequest, jsonResponse, verifyRequest } from "./auth.mjs";

export const handler = async (event) => {
  const auth = verifyRequest(event);
  if (!auth.ok) return auth.response;
  if (event.httpMethod !== "POST") return jsonResponse(405, { error: "Method not allowed" });
  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return jsonResponse(400, { error: "Invalid JSON" });
  }
  const { path: rawPath, sha, message } = body;
  if (!rawPath || !sha) return jsonResponse(400, { error: "Path and sha required" });
  const path = enforceContentPath(rawPath);
  const env = getEnv();
  try {
    const res = await githubRequest(env, `/contents/${path}`, {
      method: "DELETE",
      body: JSON.stringify({
        message: message || `Delete ${path}`,
        sha,
        branch: env.github.branch,
      }),
    });
    const data = await res.json();
    if (!res.ok) return jsonResponse(res.status, { error: data?.message || "GitHub error" });
    return jsonResponse(200, { ok: true });
  } catch (err) {
    console.error(err);
    return jsonResponse(500, { error: "Failed to delete post" });
  }
};
