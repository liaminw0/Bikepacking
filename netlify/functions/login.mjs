import { authCookie, getEnv, jsonResponse, unauthorized, signToken } from "./auth.mjs";

export const handler = async (event) => {
  if (event.httpMethod !== "POST") return jsonResponse(405, { error: "Method not allowed" });
  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return jsonResponse(400, { error: "Invalid JSON" });
  }
  const { password } = payload;
  const env = getEnv();
  if (password !== env.adminPassword) {
    return unauthorized("Invalid password");
  }
  const token = await signToken({ role: "admin" });
  return jsonResponse(200, { ok: true }, { "Set-Cookie": authCookie(token) });
};
