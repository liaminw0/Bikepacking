import { clearCookie, jsonResponse } from "./auth.js";

export async function handler() {
  return jsonResponse(200, { ok: true }, { "Set-Cookie": clearCookie() });
}
