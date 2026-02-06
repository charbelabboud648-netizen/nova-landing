import { connectLambda, getStore } from "@netlify/blobs";

const STORE_NAME = "nova-site";
const SETTINGS_KEY = "settings";

// Keep in sync with the defaults embedded in site/index.html.
const DEFAULT_SETTINGS = {
  brand: "Nova",
  accent: "#0071e3",
  accent2: "#0a84ff",
  kicker: "A clean, Apple-inspired layout • single plan • static demo",
  headline: "Premium membership.\nSimple to buy.",
  subhead:
    "A polished landing page that feels like a real product site on iOS, Android, and PC. Replace the brand name and copy for your legitimate product.",
  planName: "Premium Membership",
  planMeta: "Monthly • Instant access",
  planTag: "Most popular",
  perText: "per month",
  price: 9.99,
  features: [
    "Instant activation (connect your delivery flow later).",
    "Premium features (customize for your product).",
    "Priority support (add WhatsApp/email links).",
    "Netlify-ready static site (drop and publish).",
  ],
};

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type, authorization",
  "access-control-allow-methods": "GET,PUT,OPTIONS",
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

function safeString(value, { fallback = "", max = 200 } = {}) {
  const s = typeof value === "string" ? value.trim() : "";
  if (!s) return fallback;
  // Remove angle brackets to reduce XSS risk if a consumer uses innerHTML.
  const cleaned = s.replaceAll("<", "").replaceAll(">", "");
  return cleaned.slice(0, max);
}

function safeHexColor(value, fallback) {
  const s = typeof value === "string" ? value.trim() : "";
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(s)) return s;
  return fallback;
}

function safeNumber(value, { fallback = 0, min = -Infinity, max = Infinity } = {}) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function safeStringArray(value, { fallback = [], maxItems = 10, maxLen = 120 } = {}) {
  if (!Array.isArray(value)) return fallback;
  const out = [];
  for (const v of value) {
    const s = safeString(v, { fallback: "", max: maxLen });
    if (s) out.push(s);
    if (out.length >= maxItems) break;
  }
  return out.length ? out : fallback;
}

function mergeAndValidateSettings(input) {
  // Only allow a known set of keys.
  const s = input && typeof input === "object" ? input : {};

  const merged = {
    ...DEFAULT_SETTINGS,

    brand: safeString(s.brand, { fallback: DEFAULT_SETTINGS.brand, max: 40 }),
    accent: safeHexColor(s.accent, DEFAULT_SETTINGS.accent),
    accent2: safeHexColor(s.accent2, DEFAULT_SETTINGS.accent2),

    kicker: safeString(s.kicker, { fallback: DEFAULT_SETTINGS.kicker, max: 120 }),
    headline: safeString(s.headline, { fallback: DEFAULT_SETTINGS.headline, max: 140 }),
    subhead: safeString(s.subhead, { fallback: DEFAULT_SETTINGS.subhead, max: 400 }),

    planName: safeString(s.planName, { fallback: DEFAULT_SETTINGS.planName, max: 60 }),
    planMeta: safeString(s.planMeta, { fallback: DEFAULT_SETTINGS.planMeta, max: 80 }),
    planTag: safeString(s.planTag, { fallback: DEFAULT_SETTINGS.planTag, max: 40 }),
    perText: safeString(s.perText, { fallback: DEFAULT_SETTINGS.perText, max: 40 }),

    price: safeNumber(s.price, { fallback: DEFAULT_SETTINGS.price, min: 0, max: 9999 }),

    features: safeStringArray(s.features, {
      fallback: DEFAULT_SETTINGS.features,
      maxItems: 12,
      maxLen: 140,
    }),
  };

  return merged;
}

function getNetlifyIdentity(context) {
  // Netlify encodes Identity info into a base64 string at `context.clientContext.custom.netlify`.
  // https://docs.netlify.com/build/functions/functions-and-identity/
  try {
    const raw = context?.clientContext?.custom?.netlify;
    if (!raw) return null;
    const decoded = Buffer.from(raw, "base64").toString("utf-8");
    const parsed = JSON.parse(decoded);
    return parsed;
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

export const handler = async (event, context) => {
  // Required for Netlify Blobs when using Lambda compatibility mode.
  // See: @netlify/blobs docs (Lambda compatibility mode).
  connectLambda(event);

  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: { ...CORS_HEADERS },
      body: "",
    };
  }

  const store = getStore(STORE_NAME);

  if (event.httpMethod === "GET") {
    const stored = await store.get(SETTINGS_KEY, { type: "json" });
    const merged = mergeAndValidateSettings(stored);
    if (stored && typeof stored === "object" && stored._meta) {
      merged._meta = stored._meta;
    }
    return json(200, merged);
  }

  if (event.httpMethod === "PUT") {
    const netlifyCtx = getNetlifyIdentity(context);
    const user = netlifyCtx?.user;

    if (!user) {
      return json(401, { error: "Unauthorized" });
    }

    if (!isAdmin(user)) {
      return json(403, { error: "Forbidden (admin role required)" });
    }

    let payload;
    try {
      payload = event.body ? JSON.parse(event.body) : {};
    } catch {
      return json(400, { error: "Invalid JSON" });
    }

    const merged = mergeAndValidateSettings(payload);
    const record = {
      ...merged,
      _meta: {
        updatedAt: new Date().toISOString(),
        updatedBy: user.email || user.sub || "unknown",
      },
    };

    await store.setJSON(SETTINGS_KEY, record);
    return json(200, record);
  }

  return json(405, { error: "Method not allowed" }, { allow: "GET,PUT,OPTIONS" });
};
