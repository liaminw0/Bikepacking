function setProcessEnv(bindings) {
  const previousProcess = globalThis.process;
  const previousEnv = previousProcess?.env;
  const env = {
    ...(previousEnv || {}),
    ...bindings,
  };

  if (previousProcess) {
    previousProcess.env = env;
  } else {
    globalThis.process = { env };
  }

  return () => {
    if (previousProcess) {
      previousProcess.env = previousEnv;
    } else {
      delete globalThis.process;
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

export function createNetlifyOnRequest(handler) {
  return async function onRequest(context) {
    const restoreEnv = setProcessEnv({
      NODE_ENV: "production",
      ...(context.env || {}),
    });

    try {
      const event = await createEvent(context.request);
      const result = await handler(event, context);
      return toResponse(result);
    } finally {
      restoreEnv();
    }
  };
}
