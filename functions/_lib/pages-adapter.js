function setRuntimeEnv(bindings) {
  const previousEnv = globalThis.__CF_PAGES_ENV__;
  globalThis.__CF_PAGES_ENV__ = {
    NODE_ENV: "production",
    ...(previousEnv || {}),
    ...bindings,
  };

  return () => {
    if (typeof previousEnv === "undefined") {
      delete globalThis.__CF_PAGES_ENV__;
    } else {
      globalThis.__CF_PAGES_ENV__ = previousEnv;
    }
  };
}

function headersToObject(headers) {
  const result = {};
  for (const [key, value] of headers.entries()) {
    result[key] = value;
  }
  return result;
}

function queryParamsToObject(url) {
  const result = {};
  for (const [key, value] of url.searchParams.entries()) {
    result[key] = value;
  }
  return result;
}

async function createEvent(request) {
  const url = new URL(request.url);
  const text = request.method === "GET" || request.method === "HEAD" ? "" : await request.text();

  return {
    httpMethod: request.method,
    headers: headersToObject(request.headers),
    body: text,
    queryStringParameters: queryParamsToObject(url),
    rawUrl: request.url,
    path: url.pathname,
  };
}

function toResponse(result) {
  if (result instanceof Response) return result;

  const headers = new Headers(result?.headers || {});
  const body = result?.body ?? "";
  return new Response(body, {
    status: result?.statusCode || 200,
    headers,
  });
}

export function createPagesHandler(handler) {
  return async function onRequest(context) {
    const restoreEnv = setRuntimeEnv(context.env || {});

    try {
      const event = await createEvent(context.request);
      const result = await handler(event, context);
      return toResponse(result);
    } catch (error) {
      console.error("Function adapter error", error);
      return new Response(JSON.stringify({
        error: error?.message || "Internal server error",
      }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      });
    } finally {
      restoreEnv();
    }
  };
}
