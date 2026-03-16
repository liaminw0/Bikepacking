import { decodeRepoContent, enforceContentPath, getEnv, githubRequest, jsonResponse, verifyRequest } from "./auth.js";

export async function handler(event) {
  const auth = await verifyRequest(event);
  if (!auth.ok) return auth.response;
  const env = getEnv();
  try {
    const dirs = env.contentDirs?.length ? env.contentDirs : ["content/posts"];
    const items = [];
    const parseFrontMatter = (file) => {
      try {
        const content = decodeRepoContent(file.content || "", file.encoding || "base64");
        const match = /^---\n([\s\S]*?)\n---/m.exec(content);
        if (!match) return {};
        const lines = match[1].split("\n");
        const result = {};
        for (const line of lines) {
          const [key, ...rest] = line.split(":");
          if (!key || rest.length === 0) continue;
          const normalizedKey = key.trim();
          const value = rest.join(":").trim();
          if (value.startsWith("[") && value.endsWith("]")) {
            result[normalizedKey] = value
              .slice(1, -1)
              .split(",")
              .map((entry) => entry.trim().replace(/^"|"$/g, ""))
              .filter(Boolean);
          } else if (value === "true" || value === "false") {
            result[normalizedKey] = value === "true";
          } else {
            result[normalizedKey] = value.replace(/^"|"$/g, "");
          }
        }
        return result;
      } catch {
        return {};
      }
    };

    const fetchWithLimit = async (tasks, limit = 5) => {
      const results = [];
      let idx = 0;
      const workers = Array(Math.min(limit, tasks.length))
        .fill(null)
        .map(async () => {
          while (idx < tasks.length) {
            const current = idx++;
            results[current] = await tasks[current]();
          }
        });
      await Promise.all(workers);
      return results;
    };

    for (const dir of dirs) {
      const res = await githubRequest(env, `/contents/${dir}?ref=${env.github.branch}`);
      if (res.status === 404) continue;
      const data = await res.json();
      if (!res.ok) {
        return jsonResponse(res.status, { error: data?.message || "GitHub error" });
      }
      const files = (Array.isArray(data) ? data : []).filter((f) => f.type === "file");
      const tasks = files.map((f) => async () => {
        try {
          const fres = await githubRequest(env, `/contents/${f.path}?ref=${env.github.branch}`);
          const fdata = await fres.json();
          const frontMatter = fres.ok ? parseFrontMatter(fdata) : {};
          return {
            name: f.name,
            path: enforceContentPath(f.path, env),
            sha: f.sha,
            size: f.size,
            section: dir,
            title: frontMatter.title || null,
            date: frontMatter.date || null,
            tags: Array.isArray(frontMatter.tags) ? frontMatter.tags : [],
          };
        } catch {
          return {
            name: f.name,
            path: enforceContentPath(f.path, env),
            sha: f.sha,
            size: f.size,
            section: dir,
            title: null,
            date: null,
            tags: [],
          };
        }
      });
      const results = await fetchWithLimit(tasks, 5);
      items.push(...results);
    }
    return jsonResponse(200, { items, contentDirs: dirs });
  } catch (err) {
    console.error(err);
    return jsonResponse(500, { error: "Failed to list posts" });
  }
}
