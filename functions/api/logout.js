import { handler } from "../_lib/logout.js";
import { createPagesHandler } from "../_lib/pages-adapter.js";

export const onRequest = createPagesHandler(handler);
