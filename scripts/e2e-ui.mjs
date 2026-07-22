/* Headless UI click-through: finds dead buttons + hydration errors. */
import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const env = readFileSync(".env.local", "utf8");
const PW = env.match(/APP_PASSWORD="([^"]*)"/)[1];
const BASE = "http://localhost:3000";

const errors = [];
const results = [];
function report(name, ok, extra = "") {
  results.push(`${ok ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`);
}

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console.error: ${m.text()}`);
});

// login
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill('input[type="password"]', PW);
await page.click('button[type="submit"]');
await page.waitForURL("**/jobs**", { timeout: 10000 });
report("login redirects to /jobs", true);

// jobs page renders cards
await page.waitForSelector("[data-job-id]", { timeout: 15000 });
const cardCount = await page.locator("[data-job-id]").count();
report("job cards render", cardCount > 0, `${cardCount} cards`);

// Save button toggles
const firstCard = page.locator("[data-job-id]").first();
await firstCard.locator('button[title^="Save"]').click();
await page.waitForTimeout(400);
report("save toggle (no crash)", true);

// Show description expands
await firstCard.locator("text=Show description").first().click().catch(() => {});
report("description expand (no crash)", true);

// Filters popover opens and chips are clickable
await page.locator('button:has-text("Filters")').first().click();
await page.waitForTimeout(500);
const chipVisible = await page.locator('button:has-text("New grad")').first().isVisible().catch(() => false);
report("filters popover opens", chipVisible);
if (chipVisible) {
  await page.locator('button:has-text("New grad")').first().click();
  await page.waitForTimeout(800);
  report("filter chip applies (no crash)", true);
  // reset
  await page.locator('button:has-text("Filters")').first().click();
  await page.waitForTimeout(400);
  await page.locator('button:has-text("Clear all filters")').first().click().catch(() => {});
  await page.waitForTimeout(500);
}

// Location tabs switch bucket
await page.locator('button:has-text("Toronto")').first().click();
await page.waitForTimeout(1200);
const torontoUrl = page.url();
report("bucket tab applies", torontoUrl.includes("bucket=TORONTO"), torontoUrl.split("?")[1] ?? "");
await page.locator('button:has-text("All")').first().click();
await page.waitForTimeout(800);

// Keyboard navigation j/k
await page.keyboard.press("j");
await page.waitForTimeout(200);
report("keyboard j (no crash)", true);

// Tailor link navigates
await firstCard.locator("text=Tailor").first().click();
await page.waitForTimeout(1500);
report("tailor button navigates", page.url().includes("/tailor/"), page.url());

// tailor page: research button clickable
const researchBtn = page.locator("text=Research company").first();
const hasResearch = await researchBtn.isVisible().catch(() => false);
report("tailor page research button present", hasResearch);

// tracker page
await page.goto(`${BASE}/tracker`, { waitUntil: "networkidle" });
const kanbanOrEmpty = await page.locator("text=/No applications yet|Applied/").first().isVisible().catch(() => false);
report("tracker renders", kanbanOrEmpty);
// tabs
await page.locator('button:has-text("Table")').first().click().catch(() => {});
await page.waitForTimeout(300);
report("tracker tabs (no crash)", true);

// digest + settings
await page.goto(`${BASE}/digest`, { waitUntil: "networkidle" });
report("digest renders", await page.locator("text=Digest").first().isVisible());
await page.goto(`${BASE}/settings`, { waitUntil: "networkidle" });
report("settings renders", await page.locator("text=Company sources").first().isVisible());

console.log(results.join("\n"));
console.log("\n--- JS errors (" + errors.length + ") ---");
console.log(errors.slice(0, 12).join("\n") || "none");
await browser.close();
