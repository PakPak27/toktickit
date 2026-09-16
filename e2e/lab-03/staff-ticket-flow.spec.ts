import { test, expect } from "@playwright/test";
import { loginAsUI, logoutViaUI } from "./helpers.js";

const RUN_ID = Date.now();
const MARKER = `staff-e2e-${RUN_ID}`;

// E2E-03 / AC-07, AC-09, AC-11, AC-12
test("full IT Staff flow: claim, IT Priority, status transition, Public Comment, Internal Note — never visible to the Requester", async ({ page }) => {
  // 1. Requester creates a ticket to work with.
  await loginAsUI(page, "jennifer.anderson@example.com");
  await page.getByRole("link", { name: "Create Ticket", exact: true }).click();
  await page.waitForURL("**/tickets/new");
  await page.selectOption("#categorySelect", { index: 1 });
  await page.selectOption("#relatedSystemSelect", { index: 1 });
  await page.selectOption("#prioritySelect", "MEDIUM");
  await page.fill("#summaryInput", MARKER);
  await page.fill("#descriptionInput", "A ticket created for the Lab 3 IT Staff E2E flow.");
  await page.getByText("Submit Ticket").click();
  await expect(page.getByText(/Your ticket number is/i)).toBeVisible();
  const ticketNumber = (await page.locator("strong").last().textContent())!.trim();
  await logoutViaUI(page);

  // 2. IT Staff finds it in the Queue and opens it.
  await loginAsUI(page, "kevin.patel@toktickit.com");
  await page.getByRole("link", { name: "Ticket Queue" }).click();
  await page.waitForURL("**/staff/queue");
  await page.fill('input[placeholder*="Search by ticket number"]', MARKER);
  await page.getByRole("link", { name: ticketNumber }).click();
  await page.waitForURL(/\/staff\/tickets\/\d+$/);

  // 3. Claim, set IT Priority, and walk one valid status transition.
  await page.getByText("Claim for me").click();
  await expect(page.locator("#ownerSelect")).toHaveValue(/.+/, { timeout: 10000 });
  await page.selectOption("#itPrioritySelect", "HIGH");
  await page.selectOption("#statusSelect", "OPEN");
  await expect(page.locator("#statusSelect")).toContainText("OPEN");

  // 4. Post a Public Comment (default tab) and an Internal Note.
  await page.fill('input[placeholder="Type your comment here…"]', "We are investigating this issue.");
  await page.getByText("Post Comment").click();
  await expect(page.getByText("We are investigating this issue.")).toBeVisible();

  await page.getByRole("button", { name: /Internal Notes, staff only/i }).click();
  await page.fill('input[placeholder="Type an internal note here…"]', "Escalated to the hardware vendor.");
  await page.getByText("Post Note").click();
  await expect(page.getByText("Escalated to the hardware vendor.")).toBeVisible();
  await logoutViaUI(page);

  // 5. The Requester sees the Public Comment but never the Internal Note.
  await loginAsUI(page, "jennifer.anderson@example.com");
  await page.getByRole("link", { name: "My Tickets", exact: true }).click();
  await page.fill('input[placeholder*="Search by ticket number"]', MARKER);
  await page.getByRole("link", { name: ticketNumber }).click();
  await page.waitForURL(/\/tickets\/\d+$/);

  await expect(page.getByText("We are investigating this issue.")).toBeVisible();
  await expect(page.getByText("Escalated to the hardware vendor.")).toHaveCount(0);
});
