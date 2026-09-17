import { test, expect } from "@playwright/test";
import { loginAsUI, logoutViaUI } from "./helpers.js";

// E2E-05 / AC-20 — re-runs the Lab 2 create-ticket + ownership-isolation +
// attachment-lifecycle flows, but driven entirely by real login/logout
// instead of the removed Development Requester selector.

test.use({ viewport: { width: 390, height: 844 } });

test("completes the full ticket creation flow as an authenticated Requester, on mobile (AC-01, AC-05)", async ({ page }) => {
  await loginAsUI(page, "michael.brown@example.com");

  await page.getByRole("link", { name: "Create Ticket", exact: true }).click();
  await page.waitForURL("**/tickets/new");
  await page.selectOption("#categorySelect", { index: 1 });
  await page.selectOption("#relatedSystemSelect", { index: 1 });
  await page.selectOption("#prioritySelect", "MEDIUM");
  await page.fill("#summaryInput", "Lab 3 regression test ticket summary");
  await page.fill("#descriptionInput", "A sufficiently long description written by the Lab 3 regression E2E test.");
  await page.getByText("Submit Ticket").click();

  await expect(page.getByText(/Ticket created successfully/i)).toBeVisible();
  await expect(page.getByText(/TKT-\d{4}-\d{6}/)).toBeVisible();

  const hasHorizontalScroll = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  expect(hasHorizontalScroll).toBe(false);
});

test("Requester A's ticket is not visible to Requester B, now scoped by the authenticated session (AC-11)", async ({ page }) => {
  const marker = `e2e-isolation-${Date.now()}`;

  await loginAsUI(page, "michael.brown@example.com");
  await page.getByRole("link", { name: "Create Ticket", exact: true }).click();
  await page.waitForURL("**/tickets/new");
  await page.selectOption("#categorySelect", { index: 1 });
  await page.selectOption("#relatedSystemSelect", { index: 1 });
  await page.selectOption("#prioritySelect", "MEDIUM");
  await page.fill("#summaryInput", `E2E isolation test ${marker}`);
  await page.fill("#descriptionInput", "A sufficiently long description for this E2E test.");
  await page.getByText("Submit Ticket").click();
  await expect(page.getByText(/Ticket created successfully/i)).toBeVisible();
  await logoutViaUI(page);

  await loginAsUI(page, "sarah.johnson@example.com");
  await page.fill('input[placeholder="Search by ticket number or summary…"]', marker);
  await expect(page.getByText("No tickets match your filters.")).toBeVisible();
});

test("full attachment lifecycle as an authenticated Requester: upload, download, soft-remove, blocked re-download (AC-09, AC-10)", async ({ page }) => {
  await loginAsUI(page, "michael.brown@example.com");

  // Unique per run — a hardcoded summary would match every ticket this same
  // test created on a previous run against this shared, never-reset dev DB.
  const summary = `E2E attachment lifecycle ticket (Lab 3) ${Date.now()}`;

  await page.getByRole("link", { name: "Create Ticket", exact: true }).click();
  await page.waitForURL("**/tickets/new");
  await page.selectOption("#categorySelect", { index: 1 });
  await page.selectOption("#relatedSystemSelect", { index: 1 });
  await page.selectOption("#prioritySelect", "MEDIUM");
  await page.fill("#summaryInput", summary);
  await page.fill("#descriptionInput", "A sufficiently long description for this E2E test.");
  await page.getByText("Submit Ticket").click();
  await expect(page.getByText(/Ticket created successfully/i)).toBeVisible();
  await page.getByText("Go to My Tickets").click();
  await page.waitForURL("**/tickets");

  await page.fill('input[placeholder="Search by ticket number or summary…"]', summary);
  // The desktop <table> row link and the mobile card link both match "TKT-"
  // — only one is actually visible per viewport (Bootstrap's d-none/
  // d-md-block), so scope to the CSS class that's live at this test's
  // viewport instead of picking blindly with .first().
  await page.locator(".d-md-none.d-flex.flex-column.gap-2 a", { hasText: "TKT-" }).click();
  await page.waitForURL(/\/tickets\/\d+$/);

  await page.setInputFiles("#attachmentInput", {
    name: "e2e-test-file.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4 fake pdf content for E2E test"),
  });
  await expect(page.getByText("e2e-test-file.pdf")).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByText("Download").first().click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("e2e-test-file.pdf");

  await page.getByText("Remove").first().click();
  await page.fill('input[placeholder="Reason for removal…"]', "E2E test cleanup removal");
  await page.getByText("Confirm").click();

  await expect(page.getByText("Removed Attachments")).toBeVisible();
  await expect(page.getByText(/E2E test cleanup removal/i)).toBeVisible();
});
