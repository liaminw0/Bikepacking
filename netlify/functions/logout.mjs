import { clearCookie, jsonResponse } from "./auth.mjs";

export const handler = async () => {
  return jsonResponse(200, { ok: true }, { "Set-Cookie": clearCookie() });
};
