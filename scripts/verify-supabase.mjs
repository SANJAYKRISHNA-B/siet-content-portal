import { readFile } from "node:fs/promises";

async function readEnv(path) {
  try {
    const text = await readFile(path, "utf8");
    return Object.fromEntries(
      text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#") && line.includes("="))
        .map((line) => {
          const index = line.indexOf("=");
          return [
            line.slice(0, index),
            line.slice(index + 1).replace(/^['"]|['"]$/g, ""),
          ];
        }),
    );
  } catch {
    return {};
  }
}

const fileEnv = await readEnv(".env.local");
const url =
  process.env.NEXT_PUBLIC_SUPABASE_URL || fileEnv.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  fileEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  fileEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (
  !url ||
  !key ||
  url.includes("YOUR_PROJECT") ||
  key.includes("YOUR_SUPABASE")
) {
  console.error(
    "Supabase verification skipped: configure the project URL and publishable key in .env.local.",
  );
  process.exit(1);
}

const headers = { apikey: key, Authorization: `Bearer ${key}` };
const checks = [];

async function check(name, request, validate) {
  try {
    const response = await request();
    const body = await response.text();
    const result = validate(response, body);
    checks.push({ name, ok: result.ok, detail: result.detail });
  } catch (error) {
    checks.push({
      name,
      ok: false,
      detail: error instanceof Error ? error.message : "request failed",
    });
  }
}

await check(
  "Auth service",
  () => fetch(`${url}/auth/v1/health`, { headers: { apikey: key } }),
  (response) => ({ ok: response.ok, detail: `HTTP ${response.status}` }),
);

await check(
  "submissions table + anonymous RLS",
  () => fetch(`${url}/rest/v1/submissions?select=id&limit=1`, { headers }),
  (response, body) => {
    if (!response.ok)
      return {
        ok: false,
        detail: `HTTP ${response.status}; run supabase/schema.sql`,
      };
    try {
      const rows = JSON.parse(body);
      return Array.isArray(rows) && rows.length === 0
        ? {
            ok: true,
            detail: "table reachable; anonymous access returns no rows",
          }
        : {
            ok: false,
            detail: "anonymous access returned data; review RLS policies",
          };
    } catch {
      return { ok: false, detail: "unexpected REST response" };
    }
  },
);

await check(
  "private content-files bucket",
  () =>
    fetch(`${url}/storage/v1/object/list/content-files`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ prefix: "", limit: 1 }),
    }),
  (response, body) => {
    if (!response.ok)
      return {
        ok: false,
        detail: `HTTP ${response.status}; run supabase/schema.sql`,
      };
    try {
      const objects = JSON.parse(body);
      return Array.isArray(objects) && objects.length === 0
        ? {
            ok: true,
            detail: "bucket reachable; anonymous listing returns no objects",
          }
        : {
            ok: false,
            detail:
              "anonymous listing returned objects; review storage policies",
          };
    } catch {
      return { ok: false, detail: "unexpected Storage response" };
    }
  },
);

for (const item of checks)
  console.log(`${item.ok ? "PASS" : "FAIL"}  ${item.name}: ${item.detail}`);
if (checks.some((item) => !item.ok)) process.exit(1);
