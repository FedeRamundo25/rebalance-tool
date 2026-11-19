export async function onRequest(context) {
  const url = new URL(context.request.url);
  if (!url.pathname.startsWith('/api/') && !url.pathname.startsWith('/auth/')) {
    return context.next();
  }

  const upstream = context.env.RENDER_API_ORIGIN;
  if (!upstream) return new Response('API origin is not configured', { status: 503 });

  const target = new URL(`${url.pathname}${url.search}`, upstream);
  const headers = new Headers(context.request.headers);
  headers.set('x-forwarded-host', url.host);
  headers.set('x-forwarded-proto', url.protocol.slice(0, -1));
  return fetch(target, {
    method: context.request.method,
    headers,
    body: context.request.method === 'GET' || context.request.method === 'HEAD' ? undefined : context.request.body,
    redirect: 'manual',
  });
}
