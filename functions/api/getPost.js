import { handler } from "../../netlify/functions/getPost.mjs";
import { createNetlifyOnRequest } from "./_lib/netlify-adapter.js";

export const onRequest = createNetlifyOnRequest(handler);
