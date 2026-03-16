export const COOKIE_NAME = "hugo_admin";
const WEEK = 7 * 24 * 60 * 60;
const encoder = new TextEncoder();

const baseHeaders = {
  "Content-Type": "application/json",
};

export function jsonResponse(statusCode, body, headers = {}) {
  return {
    statusCode,
    headers: { ...baseHeaders, ...headers },
    body: JSON.stringify(body),
  };
}

export function unauthorized(message = "Unauthorized") {
  return jsonResponse(401, { error: message });
}

export function getEnv(options = {}) {
  const {
    requireAuth = true,
    requireGithub = true,
  } = options;
  const {
    ADMIN_PASSWORD,
    JWT_SECRET,
    GITHUB_TOKEN,
    GITHUB_OWNER,
    GITHUB_REPO,
    GITHUB_BRANCH,
    CONTENT_DIR,
    CONTENT_DIRS,
    NEXTCLOUD_BASE_URL,
    NEXTCLOUD_USERNAME,
    NEXTCLOUD_PASSWORD,
    NEXTCLOUD_FOLDER,
    NEXTCLOUD_PUBLIC_BASE_URL,
  } = process.env;
  if (requireAuth && (!ADMIN_PASSWORD || !JWT_SECRET)) {
    throw new Error("Missing ADMIN_PASSWORD or JWT_SECRET");
  }
  if (requireGithub && (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO)) {
    throw new Error("Missing GitHub configuration");
  }
  return {
    adminPassword: ADMIN_PASSWORD,
    jwtSecret: JWT_SECRET,
    github: {
      token: GITHUB_TOKEN,
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      branch: GITHUB_BRANCH || "main",
    },
    contentDirs: (CONTENT_DIRS || CONTENT_DIR || "content/journal,content/photos")
      .split(",")
      .map((d) => d.trim())
      .filter(Boolean)
      .map((d) => d.replace(/^\//, "").replace(/\/+$/, "")),
    nextcloud: {
      baseUrl: NEXTCLOUD_BASE_URL?.replace(/\/+$/, "") || null,
      username: NEXTCLOUD_USERNAME || null,
      password: NEXTCLOUD_PASSWORD || null,
      folder: (NEXTCLOUD_FOLDER || "").replace(/^\/+|\/+$/g, ""),
      publicBaseUrl: (NEXTCLOUD_PUBLIC_BASE_URL || NEXTCLOUD_BASE_URL || "").replace(/\/+$/, ""),
    },
  };
}

export function parseCookies(header = "") {
  return header.split(";").reduce((acc, part) => {
    const [k, v] = part.trim().split("=");
    if (k) acc[k] = decodeURIComponent(v || "");
    return acc;
  }, {});
}

function toBase64Url(value) {
  const bytes = typeof value === "string" ? encoder.encode(value) : value;
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function importSigningKey(secret) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function createSignature(input, secret) {
  const key = await importSigningKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(input));
  return toBase64Url(new Uint8Array(signature));
}

function decodeJsonSegment(segment) {
  const bytes = fromBase64Url(segment);
  return JSON.parse(new TextDecoder().decode(bytes));
}

export async function signToken(payload) {
  const { jwtSecret } = getEnv({ requireGithub: false });
  const header = { alg: "HS256", typ: "JWT" };
  const body = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + WEEK,
  };
  const encodedHeader = toBase64Url(JSON.stringify(header));
  const encodedBody = toBase64Url(JSON.stringify(body));
  const signature = await createSignature(`${encodedHeader}.${encodedBody}`, jwtSecret);
  return `${encodedHeader}.${encodedBody}.${signature}`;
}

export async function verifyRequest(event) {
  try {
    const cookies = parseCookies(event.headers?.cookie || event.headers?.Cookie || "");
    const token = cookies[COOKIE_NAME];
    if (!token) return { ok: false, response: unauthorized() };
    const { jwtSecret } = getEnv({ requireGithub: false });
    const [encodedHeader, encodedBody, signature] = token.split(".");
    if (!encodedHeader || !encodedBody || !signature) return { ok: false, response: unauthorized() };
    const expectedSignature = await createSignature(`${encodedHeader}.${encodedBody}`, jwtSecret);
    if (signature !== expectedSignature) return { ok: false, response: unauthorized() };
    const payload = decodeJsonSegment(encodedBody);
    if (!payload?.exp || payload.exp < Math.floor(Date.now() / 1000)) {
      return { ok: false, response: unauthorized() };
    }
    return { ok: true, payload };
  } catch (err) {
    console.error("Auth error", err);
    return { ok: false, response: unauthorized() };
  }
}

export function authCookie(token) {
  const secure = process.env.NODE_ENV === "production" ? " Secure;" : "";
  return `${COOKIE_NAME}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${WEEK};${secure}`;
}

export function clearCookie() {
  const secure = process.env.NODE_ENV === "production" ? " Secure;" : "";
  return `${COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0;${secure}`;
}

export function enforceContentPath(path, env) {
  if (!path) throw new Error("Path required");
  if (path.includes("..")) throw new Error("Invalid path");
  const bases = env?.contentDirs?.length ? env.contentDirs : ["content/posts"];
  const match = bases.find((b) => path.startsWith(`${b}/`));
  if (match) return path;
  return `${bases[0]}/${path.replace(/^\/+/, "")}`;
}

export async function githubRequest(env, resourcePath, init = {}) {
  const url = `https://api.github.com/repos/${env.github.owner}/${env.github.repo}${resourcePath}`;
  const res = await fetch(url, {
    method: init.method || "GET",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${env.github.token}`,
      "User-Agent": "hugo-admin",
      ...(init.headers || {}),
    },
    body: init.body,
  });
  return res;
}

export function getNextcloudConfig(required = true) {
  const cfg = getEnv().nextcloud || {};
  const baseUrl = cfg.baseUrl?.replace(/\/+$/, "");
  if ((!baseUrl || !cfg.username || !cfg.password) && required) {
    throw new Error("Missing Nextcloud configuration");
  }
  if (!baseUrl || !cfg.username || !cfg.password) return null;
  return {
    baseUrl,
    username: cfg.username,
    password: cfg.password,
    folder: (cfg.folder || "").replace(/^\/+|\/+$/g, ""),
    publicBaseUrl: (cfg.publicBaseUrl || baseUrl).replace(/\/+$/, ""),
  };
}
