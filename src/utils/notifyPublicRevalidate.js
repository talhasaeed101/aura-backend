/**
 * Fire-and-forget on-demand revalidation of the public Next.js site.
 * Requires PUBLIC_SITE_URL + REVALIDATE_SECRET on the API.
 * Never throws into request handlers.
 */

const TAG_BY_RESOURCE = {
  Service: ["public-services"],
  "Use Case": ["public-use-cases"],
  "Case Study": ["public-case-studies"],
  "Blog Post": ["public-blog"],
  Vehicle: ["public-fleet"],
  Settings: ["public-settings"],
};

function resolvePublicSiteUrl() {
  const raw =
    process.env.PUBLIC_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    "";
  return raw.replace(/\/+$/, "");
}

async function notifyPublicRevalidate({
  resourceLabel,
  paths = [],
  tags = [],
} = {}) {
  const secret = process.env.REVALIDATE_SECRET?.trim();
  const base = resolvePublicSiteUrl();
  if (!secret || !base) return { skipped: true };

  const mapped = TAG_BY_RESOURCE[resourceLabel] || [];
  const body = {
    tags: [...new Set([...mapped, ...tags].filter(Boolean))],
    paths: [...new Set(["/", ...paths].filter(Boolean))],
  };

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4_000);
    const res = await fetch(`${base}/api/revalidate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-revalidate-secret": secret,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      console.warn(
        `[revalidate] public site returned ${res.status} for ${resourceLabel || "content"}`
      );
      return { ok: false, status: res.status };
    }
    return { ok: true };
  } catch (error) {
    console.warn(
      `[revalidate] failed for ${resourceLabel || "content"}:`,
      error instanceof Error ? error.message : "unknown"
    );
    return { ok: false };
  }
}

module.exports = {
  notifyPublicRevalidate,
  TAG_BY_RESOURCE,
};
