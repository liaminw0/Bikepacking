import { enforceContentPath, getEnv, githubRequest, jsonResponse, verifyRequest } from "./auth.mjs";

export const handler = async (event) => {
  const auth = verifyRequest(event);
  if (!auth.ok) return auth.response;
  const env = getEnv();
  try {
    const dirs = env.contentDirs?.length ? env.contentDirs : ["content/posts"];
    const items = [];
    for (const dir of dirs) {
      const res = await githubRequest(env, `/contents/${dir}?ref=${env.github.branch}`);
      if (res.status === 404) continue;
      const data = await res.json();
      if (!res.ok) {
        return jsonResponse(res.status, { error: data?.message || "GitHub error" });
      }
      (Array.isArray(data) ? data : [])
        .filter((f) => f.type === "file")
        .forEach((f) =>
          items.push({
            name: f.name,
            path: enforceContentPath(f.path, env),
            sha: f.sha,
            size: f.size,
            section: dir,
          }),
        );
    }
    return jsonResponse(200, { items, contentDirs: dirs });
  } catch (err) {
    console.error(err);
    return jsonResponse(500, { error: "Failed to list posts" });
  }
};
