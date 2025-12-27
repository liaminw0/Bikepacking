import { enforceContentPath, getEnv, githubRequest, jsonResponse, verifyRequest } from "./auth.mjs";

export const handler = async (event) => {
  const auth = verifyRequest(event);
  if (!auth.ok) return auth.response;
  const pathParam = event.queryStringParameters?.path;
  if (!pathParam) return jsonResponse(400, { error: "Path required" });
  const env = getEnv();
  const path = enforceContentPath(decodeURIComponent(pathParam), env);
  try {
    const res = await githubRequest(env, `/contents/${path}?ref=${env.github.branch}`);
    const data = await res.json();
    if (!res.ok) return jsonResponse(res.status, { error: data?.message || "GitHub error" });
    const content = Buffer.from(data.content || "", data.encoding || "base64").toString("utf8");
    return jsonResponse(200, { path, sha: data.sha, content });
  } catch (err) {
    console.error(err);
    return jsonResponse(500, { error: "Failed to fetch post" });
  }
};
