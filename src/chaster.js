const API_BASE = process.env.CHASTER_API_BASE || "https://api.chaster.app";

/**
 * Chaster Public API adapter. Use per-user OAuth access tokens.
 * Never collect Chaster passwords or print bearer tokens in logs.
 * Docs: https://docs.chaster.app/api/basics/introduction/
 */
export async function chasterRequest(path, options = {}) {
  const token = options.token;
  if (!token) throw new Error("Chaster account is not linked.");
  const response = await fetch(new URL(path, API_BASE), {
    method: options.method || "GET",
    headers: {
      Authorization: "Bearer " + token,
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {})
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {})
  });
  if (!response.ok) throw new Error("Chaster API request failed (" + response.status + ").");
  return response.status === 204 ? null : response.json();
}
export function getMyLocks(token) {
  return chasterRequest("/locks", { token });
}
export function getLock(lockId, token) {
  return chasterRequest("/locks/" + encodeURIComponent(lockId), { token });
}

/**
 * Write operations stay disabled until OAuth scopes, per-lock keyholder
 * authorization, explicit confirmation, bounds, cooldowns and audit are ready.
 */
export async function updateLockTime() {
  throw new Error("Chaster write actions are not enabled in this build.");
}
