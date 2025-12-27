import { enforceContentPath, getEnv, githubRequest, jsonResponse, verifyRequest } from "./auth.mjs";

export const handler = async (event) => {
  const auth = verifyRequest(event);
  if (!auth.ok) return auth.response;
  const env = getEnv();
  try {
    const res = await githubRequest(env, `/contents/content/posts?ref=${env.github.branch}`);
    if (res.status === 404) return jsonResponse(200, { items: [] });
    const data = await res.json();
    if (!res.ok) {
      return jsonResponse(res.status, { error: data?.message || "GitHub error" });
    }
    const items = (Array.isArray(data) ? data : []).filter((f) => f.type === "file").map((f) => ({
      name: f.name,
      path: enforceContentPath(f.path),
      sha: f.sha,
      size: f.size,
    }));
    return jsonResponse(200, { items });
  } catch (err) {
    console.error(err);
    return jsonResponse(500, { error: "Failed to list posts" });
  }
};
