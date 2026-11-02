import { test, expect } from "@playwright/test";
import { loginAsUI, logoutViaUI } from "../lab-03/helpers.js";

const MARKER = `resolve-blocked-e2e-${Date.now()}`;

// E2E-02 / AC-05: a Ticket with zero Actions Taken must stay blocked from
// RESOLVED even if the attempt reaches the server — the UI hint normally
// hides the option entirely, so this forces it into the <select> (as a
// stale/bypassed hint legitimately could) to exercise the real fallback
// path: the server's 409 RESOLUTION_BLOCKED shown inline, status unchanged.
test("a Ticket with zero Actions Taken stays blocked from RESOLVED, with the reason shown in the UI", async ({ page }) => {
  await loginAsUI(page, "jennifer.anderson@example.com");
  await page.getByRole("link", { name: "Create Ticket", exact: true }).click();
  await page.waitForURL("**/tickets/new");
  await page.selectOption("#categorySelect", { index: 1 });
  await page.selectOption("#relatedSystemSelect", { index: 1 });
  await page.selectOption("#prioritySelect", "MEDIUM");
  await page.fill("#summaryInput", MARKER);
  await page.fill("#descriptionInput", "A ticket created for the Lab 4 resolution-blocked E2E test.");
  await page.getByText("Submit Ticket").click();
  await expect(page.getByText(/Your ticket number is/i)).toBeVisible();
  const ticketNumber = (await page.locator("strong").last().textContent())!.trim();
  await logoutViaUI(page);

  await loginAsUI(page, "kevin.patel@toktickit.com");
  await page.getByRole("link", { name: "Ticket Queue", exact: true }).click();
  await page.waitForURL("**/staff/queue");
  await page.fill('input[placeholder*="Search by ticket number"]', MARKER);
  await page.getByRole("link", { name: ticketNumber }).click();
  await page.waitForURL(/\/staff\/tickets\/\d+$/);
  await page.getByText("Claim for me").click();
  await expect(page.locator("#ownerSelect")).toHaveValue(/.+/, { timeout: 10000 });
  await page.selectOption("#statusSelect", "IN_PROGRESS");
  await expect(page.locator("#statusSelect")).toContainText("IN_PROGRESS");

  // The hint correctly hides Resolved — zero Actions Taken exist yet.
  await expect(page.locator("#statusSelect option", { hasText: "RESOLVED" })).toHaveCount(0);

  // Force it into the <select>, as a stale/bypassed client hint legitimately
  // could, to prove the backend — not the hint — is the real authority.
  await page.evaluate(() => {
    const select = document.querySelector("#statusSelect") as HTMLSelectElement;
    const option = document.createElement("option");
    option.value = "RESOLVED";
    option.textContent = "RESOLVED";
    select.appendChild(option);
  });
  await page.selectOption("#statusSelect", "RESOLVED");

  await expect(page.getByText("This ticket has no recorded Actions Taken yet")).toBeVisible();
  // Still In Progress — the rejected attempt never changed anything.
  await expect(page.locator("#statusSelect")).toContainText("IN_PROGRESS");

  const fs = await import("fs");
  const dir = "artifacts/lab-04/screenshots/ticket-workflow";
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: `${dir}/resolve-blocked.png`, fullPage: true });
});
