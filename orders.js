import { connectLambda, getStore } from "@netlify/blobs";
import crypto from "node:crypto";

const ORDERS_STORE = "nova-orders";
const SETTINGS_STORE = "nova-site";
const SETTINGS_KEY = "settings";

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type, authorization",
  "access-control-allow-methods": "GET,POST,OPTIONS",
};

function json(statusCode, data, headers = {}) {
  return {
    statusCode,
    headers: {
      ...CORS_HEADERS,
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...headers,
    },
    body: JSON.stringify(data),
  };
}

function getNetlifyIdentity(context) {
  try {
    const raw = context?.clientContext?.custom?.netlify;
    if (!raw) return null;
    const decoded = Buffer.from(raw, "base64").toString("utf-8");
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

function getRolesFromUser(user) {
  const roles = user?.app_metadata?.roles;
  return Array.isArray(roles) ? roles : [];
}

function isAdmin(user) {
  return getRolesFromUser(user).includes("admin");
}

function parseQty(body) {
  const n = Number(body?.qty);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(9, Math.floor(n)));
}

function fmtMoney(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return "$0.00";
  return "$" + n.toFixed(2);
}

export const handler = async (event, context) => {
  connectLambda(event);

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: { ...CORS_HEADERS }, body: "" };
  }

  const netlifyCtx = getNetlifyIdentity(context);
  const user = netlifyCtx?.user;

  if (event.httpMethod === "POST") {
    if (!user) return json(401, { error: "Unauthorized" });

    let payload;
    try {
      payload = event.body ? JSON.parse(event.body) : {};
    } catch {
      return json(400, { error: "Invalid JSON" });
    }

    const qty = parseQty(payload);

    // Read price from the current site settings.
    const settingsStore = getStore(SETTINGS_STORE);
    const settings = (await settingsStore.get(SETTINGS_KEY, { type: "json" })) || {};
    const unitPrice = Number(settings.price ?? 9.99);
    const total = unitPrice * qty;

    const id = crypto.randomUUID();
    const ts = new Date().toISOString().replaceAll(":", "-");
    const key = `${ts}_${id}`;

    const order = {
      id,
      key,
      qty,
      unitPrice,
      total,
      currency: "USD",
      createdAt: new Date().toISOString(),
      user: {
        sub: user.sub,
        email: user.email,
      },
    };

    const ordersStore = getStore(ORDERS_STORE);
    await ordersStore.setJSON(key, order);

    return json(201, {
      ...order,
      unitPriceFormatted: fmtMoney(unitPrice),
      totalFormatted: fmtMoney(total),
    });
  }

  if (event.httpMethod === "GET") {
    if (!user) return json(401, { error: "Unauthorized" });
    if (!isAdmin(user)) return json(403, { error: "Forbidden (admin role required)" });

    const params = event.queryStringParameters || {};
    const limit = Math.max(1, Math.min(200, Number(params.limit || 50) || 50));

    const ordersStore = getStore(ORDERS_STORE);

    // List keys (paginated) and pull the latest by key (ISO-ish prefix makes this sortable).
    const keys = [];
    for await (const page of ordersStore.list({ paginate: true })) {
      for (const b of page.blobs || []) {
        keys.push(b.key);
      }
    }

    keys.sort().reverse();
    const slice = keys.slice(0, limit);

    const orders = [];
    for (const key of slice) {
      const order = await ordersStore.get(key, { type: "json" });
      if (order) orders.push(order);
    }

    return json(200, { count: orders.length, orders });
  }

  return json(405, { error: "Method not allowed" }, { allow: "GET,POST,OPTIONS" });
};
