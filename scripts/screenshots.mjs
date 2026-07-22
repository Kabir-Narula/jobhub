import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const env = readFileSync(".env.local", "utf8");
const PW = env.match(/APP_PASSWORD="([^"]*)"/)[1];
const BASE = "http://localhost:3000";

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 });
const page = await ctx.newPage();
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.screenshot({ path: "scripts/output/shot-login.png" });
await page.fill('input[type="password"]', PW);
await page.click('button[type="submit"]');
await page.waitForURL("**/jobs**", { timeout: 10000 });
await page.waitForSelector("[data-job-id]", { timeout: 15000 });
await page.hover("[data-job-id] >> nth=1");
await page.waitForTimeout(400);
await page.screenshot({ path: "scripts/output/shot-jobs.png" });

// filters popover open
await page.locator('button:has-text("Filters")').first().click();
await page.waitForTimeout(500);
await page.screenshot({ path: "scripts/output/shot-filters.png" });
await page.keyboard.press("Escape");

await page.goto(`${BASE}/tracker`, { waitUntil: "networkidle" });
await page.waitForTimeout(600);
await page.screenshot({ path: "scripts/output/shot-tracker.png" });
await page.goto(`${BASE}/tailor/cmrr6luwr003ieqwcullryny2`, { waitUntil: "networkidle" });
await page.waitForTimeout(600);
await page.screenshot({ path: "scripts/output/shot-tailor.png" });
await browser.close();
console.log("screenshots saved");
