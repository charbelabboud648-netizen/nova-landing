// Netlify Identity event function.
// Runs when an Identity user signs up and confirms their email (email+password signups).
// Use it to automatically assign roles.
//
// To make someone an admin automatically, set:
//   ADMIN_EMAILS="you@example.com,other@example.com"
//
// Docs: https://docs.netlify.com/build/functions/functions-and-identity/

function parseAdminEmails() {
  const raw = process.env.ADMIN_EMAILS || "";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export const handler = async (event) => {
  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    // Don't block signups if payload is unexpected.
    return {
      statusCode: 200,
      headers: { "content-type": "application/json; charset=utf-8" },
      body: event.body || "{}",
    };
  }

  const user = payload?.user;
  if (!user) {
    return {
      statusCode: 200,
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify(payload),
    };
  }

  const email = String(user.email || "").toLowerCase();
  const adminEmails = parseAdminEmails();

  if (email && adminEmails.includes(email)) {
    const existing = Array.isArray(user?.app_metadata?.roles) ? user.app_metadata.roles : [];
    const roles = Array.from(new Set([...existing, "admin"]));

    return {
      statusCode: 200,
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        ...user,
        app_metadata: {
          ...user.app_metadata,
          roles,
        },
      }),
    };
  }

  // No change.
  return {
    statusCode: 200,
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify(user),
  };
};
