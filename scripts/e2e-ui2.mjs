/* Deep test of the apply->return prompt loop and dialog interactions. */
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { config } from "dotenv";
config({ path: [".env.local", ".env"] });
import { PrismaClient } from "@prisma/client";

const env = readFileSync(".env.local", "utf8");
const PW = env.match(/APP_PASSWORD="([^"]*)"/)[1];
const BASE = "http://localhost:3000";
const results = [];
const errors = [];
function report(name, ok, extra = "") {
  results.push(`${ok ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`);
}

// Reset prompt state so the dialog can fire (previous runs dismiss it by design).
const prisma = new PrismaClient();
await prisma.job.updateMany({ data: { viewedAt: null, applyPromptDismissedAt: null } });
await prisma.$disconnect();

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));

await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill('input[type="password"]', PW);
await page.click('button[type="submit"]');
await page.waitForURL("**/jobs**", { timeout: 10000 });
await page.waitForSelector("[data-job-id]", { timeout: 15000 });

// Click Apply -> popup opens (then we close it, simulating returning)
const firstCard = page.locator("[data-job-id]").first();
const [popup] = await Promise.all([
  ctx.waitForEvent("page", { timeout: 8000 }).catch(() => null),
  firstCard.locator("button:has-text('Apply')").first().click(),
]);
report("apply opens posting in new tab", Boolean(popup), popup ? popup.url().slice(0, 70) : "no popup");
if (popup) await popup.close();

// Returning to the tab should trigger the "did you apply" dialog
await page.bringToFront();
await page.evaluate(() => {
  // headless: fire the events the hook listens to
  window.dispatchEvent(new Event("focus"));
  document.dispatchEvent(new Event("visibilitychange"));
});
const dialog = page.locator('[role="dialog"]');
const dialogShown = await dialog.waitFor({ state: "visible", timeout: 8000 }).then(() => true).catch(() => false);
report("'did you apply' dialog appears on return", dialogShown);

if (dialogShown) {
  // Yes -> form with selects
  await dialog.locator("button:has-text('Yes, I applied')").click();
  await page.waitForTimeout(1200);
  const notesVisible = await dialog.locator("textarea").isVisible().catch(() => false);
  report("yes opens tracking form", notesVisible);

  // the Base UI Select inside the dialog (focus-trap risk area)
  const selectTrigger = dialog.locator('[data-slot="select-trigger"]').first();
  await selectTrigger.click();
  await page.waitForTimeout(500);
  const optionVisible = await page.locator('[data-slot="select-item"], [role="option"]').first().isVisible().catch(() => false);
  report("select opens inside dialog", optionVisible);
  await page.keyboard.press("Escape");

  // Back -> Not yet (dismiss without creating an application)
  await dialog.locator("button:has-text('Back')").click().catch(() => {});
  await page.waitForTimeout(400);
  await dialog.locator("button:has-text('Not yet')").click().catch(() => {});
  await page.waitForTimeout(600);
  const gone = await dialog.isHidden().catch(() => true);
  report("not-yet dismisses dialog", gone);
}

console.log(results.join("\n"));
console.log("\n--- pageerrors (" + errors.length + ") ---");
console.log(errors.slice(0, 8).join("\n") || "none");
await browser.close();
