// Simple health check endpoint.
// GET /.netlify/functions/health  (or /api/health)

export const handler = async () => {
  return {
    statusCode: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
    body: JSON.stringify({ ok: true, service: "nova-backend", ts: new Date().toISOString() }),
  };
};
