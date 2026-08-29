import { config } from "dotenv";
config({ path: [".env.local", ".env"] });

/**
 * Hits /api/documents/[id]/pdf with a real session cookie.
 * Usage: npx tsx scripts/test-pdf-route.ts <documentVersionId>
 */
async function main() {
  const { createSessionToken, SESSION_COOKIE } = await import("../lib/auth");
  const cookie = `${SESSION_COOKIE}=${createSessionToken()}`;
  const id = process.argv[2];
  if (!id) {
    console.error("usage: npx tsx scripts/test-pdf-route.ts <documentVersionId>");
    process.exit(1);
  }
  for (const suffix of ["", "?download=1"]) {
    const res = await fetch(`http://localhost:3000/api/documents/${id}/pdf${suffix}`, {
      headers: { cookie },
      redirect: "manual",
    });
    const ct = res.headers.get("content-type");
    const buf = Buffer.from(await res.arrayBuffer());
    console.log(`${suffix || "(inline)"} -> ${res.status} ${ct} ${buf.length}b${ct?.includes("json") ? " " + buf.toString("utf8").slice(0, 200) : ""}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
