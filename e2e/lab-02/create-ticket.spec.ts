import { test, expect } from "@playwright/test";
import { selectAnyRequester } from "./helpers.js";

// Mobile viewport size only (not the full "iPhone 12" device profile, which
// forces WebKit as the browser engine) — keeps this test on Chromium per
// the Chromium-only scope noted in tests.md Section 7.
test.use({ viewport: { width: 390, height: 844 } });

test("completes the full ticket creation flow on a mobile viewport (AC-01, AC-05)", async ({ page }) => {
  await selectAnyRequester(page);

  await page.getByRole("link", { name: "Create Ticket", exact: true }).click();
  await page.waitForURL("**/tickets/new");

  await page.selectOption("#categorySelect", { index: 1 });
  await page.selectOption("#relatedSystemSelect", { index: 1 });
  await page.selectOption("#prioritySelect", "MEDIUM");
  await page.fill("#summaryInput", "E2E test ticket summary");
  await page.fill("#descriptionInput", "A sufficiently long description written by the E2E test.");

  await page.getByText("Submit Ticket").click();

  // AC-01: confirmation shows the real backend-generated Ticket Number
  await expect(page.getByText(/Ticket created successfully/i)).toBeVisible();
  await expect(page.getByText(/TKT-\d{4}-\d{6}/)).toBeVisible();

  // AC-05: no horizontal scroll on mobile
  const hasHorizontalScroll = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  expect(hasHorizontalScroll).toBe(false);
});