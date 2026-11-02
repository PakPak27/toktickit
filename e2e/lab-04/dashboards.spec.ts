import { test, expect } from "@playwright/test";
import { loginAsUI } from "../lab-03/helpers.js";
import * as fs from "fs";

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// E2E-03 / AC-09, AC-12: Requester logs in, lands on the Dashboard first,
// then drills into a metric into a pre-filtered My Tickets.
test("Requester lands on the Dashboard, then drills into Waiting for Requester", async ({ page }) => {
  await loginAsUI(page, "jennifer.anderson@example.com");
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");

  const card = page.getByRole("link", { name: /Waiting for Requester: \d+/ });
  await card.click();
  await page.waitForURL(/\/tickets\?status=WAITING_FOR_REQUESTER$/);
  await expect(page.locator("select").nth(2)).toHaveValue("WAITING_FOR_REQUESTER");
});

// E2E-04 / AC-10, AC-12: IT Staff logs in, lands on the Dashboard first, then
// drills into Unassigned into a pre-filtered Ticket Queue.
test("IT Staff lands on the Dashboard, then drills into Unassigned", async ({ page }) => {
  await loginAsUI(page, "kevin.patel@toktickit.com");
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

  const card = page.getByRole("link", { name: /Unassigned: \d+/ });
  await card.click();
  await page.waitForURL(/\/staff\/queue\?ownership=unassigned$/);
  // Filter select order on the Queue: 0=Category, 1=IT Priority, 2=Status, 3=Ownership.
  await expect(page.locator("select").nth(3)).toHaveValue("unassigned");
});

// RESP-01 — both dashboards at all three viewports.
const VIEWPORTS = {
  desktop: { width: 1280, height: 900 },
  tablet: { width: 900, height: 1000 },
  mobile: { width: 375, height: 812 },
} as const;

for (const [viewportName, size] of Object.entries(VIEWPORTS)) {
  test(`Requester Dashboard screenshot — ${viewportName}`, async ({ page }) => {
    await page.setViewportSize(size);
    await loginAsUI(page, "jennifer.anderson@example.com");
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

    const dir = "artifacts/lab-04/screenshots/requester-dashboard";
    ensureDir(dir);
    await page.screenshot({ path: `${dir}/${viewportName}.png`, fullPage: true });
  });

  test(`Staff Dashboard screenshot — ${viewportName}`, async ({ page }) => {
    await page.setViewportSize(size);
    await loginAsUI(page, "kevin.patel@toktickit.com");
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

    const dir = "artifacts/lab-04/screenshots/staff-dashboard";
    ensureDir(dir);
    await page.screenshot({ path: `${dir}/${viewportName}.png`, fullPage: true });
  });
}
