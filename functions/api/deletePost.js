import { handler } from "../../netlify/functions/deletePost.mjs";
import { createNetlifyOnRequest } from "./_lib/netlify-adapter.js";

export const onRequest = createNetlifyOnRequest(handler);
