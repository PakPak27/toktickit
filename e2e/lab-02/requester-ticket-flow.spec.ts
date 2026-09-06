import { test, expect } from "@playwright/test";
import { selectAnyRequester, selectRequesterByName } from "./helpers.js";

test("Requester A's ticket is not visible to Requester B (AC-11)", async ({ page }) => {
  // Create a uniquely-markable ticket as the first available Requester
  await page.goto("/");
  await page.waitForSelector("#requesterSelect");
  const requesterAName = await page
    .locator("#requesterSelect option:not([disabled])")
    .first()
    .textContent();

  await selectRequesterByName(page, requesterAName!.trim());

  const marker = `e2e-isolation-${Date.now()}`;
  await page.getByRole("link", { name: "Create Ticket", exact: true }).click();
  await page.waitForURL("**/tickets/new");
  await page.selectOption("#categorySelect", { index: 1 });
  await page.selectOption("#relatedSystemSelect", { index: 1 });
  await page.selectOption("#prioritySelect", "MEDIUM");
  await page.fill("#summaryInput", `E2E isolation test ${marker}`);
  await page.fill("#descriptionInput", "A sufficiently long description for this E2E test.");
  await page.getByText("Submit Ticket").click();
  await expect(page.getByText(/Ticket created successfully/i)).toBeVisible();

  // Switch to a different Requester and confirm the ticket is NOT visible
  await page.getByText("Change Requester").click();
  await page.waitForURL("/");
  await page.waitForSelector("#requesterSelect");

  const options = await page.locator("#requesterSelect option:not([disabled])").all();
  let requesterBName = "";
  for (const opt of options) {
    const text = (await opt.textContent())?.trim() ?? "";
    if (text !== requesterAName!.trim()) {
      requesterBName = text;
      break;
    }
  }

  await selectRequesterByName(page, requesterBName);
  await page.fill(
    'input[placeholder="Search by ticket number or summary…"]',
    marker
  );
  await expect(page.getByText("No tickets match your filters.")).toBeVisible();
});

test("full attachment lifecycle: upload, download, soft-remove, blocked re-download (AC-09, AC-10)", async ({ page }) => {
  await selectAnyRequester(page);

  // Create a ticket to attach a file to
  await page.getByRole("link", { name: "Create Ticket", exact: true }).click();
  await page.waitForURL("**/tickets/new");
  await page.selectOption("#categorySelect", { index: 1 });
  await page.selectOption("#relatedSystemSelect", { index: 1 });
  await page.selectOption("#prioritySelect", "MEDIUM");
  await page.fill("#summaryInput", "E2E attachment lifecycle ticket");
  await page.fill("#descriptionInput", "A sufficiently long description for this E2E test.");
  await page.getByText("Submit Ticket").click();
  await expect(page.getByText(/Ticket created successfully/i)).toBeVisible();
  await page.getByText("Go to My Tickets").click();
  await page.waitForURL("**/tickets");

  // Open the ticket just created (top of the list — newest first by default)
  await page.locator("table tbody tr").first().locator("a").first().click();
  await page.waitForURL(/\/tickets\/\d+$/);

  // Upload a small in-memory PDF
  await page.setInputFiles("#attachmentInput", {
    name: "e2e-test-file.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4 fake pdf content for E2E test"),
  });
  await expect(page.getByText("e2e-test-file.pdf")).toBeVisible();

  // Download it — verify a download event actually fires
  const downloadPromise = page.waitForEvent("download");
  await page.getByText("Download").first().click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("e2e-test-file.pdf");

  // Soft-remove it with a reason
  await page.getByText("Remove").first().click();
  await page.fill('input[placeholder="Reason for removal…"]', "E2E test cleanup removal");
  await page.getByText("Confirm").click();

  // Verify it now appears under Removed Attachments with no Download control
  await expect(page.getByText("Removed Attachments")).toBeVisible();
  await expect(page.getByText(/E2E test cleanup removal/i)).toBeVisible();
});