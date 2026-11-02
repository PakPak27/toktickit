import { test, expect } from "@playwright/test";
import { loginAsUI, logoutViaUI } from "../lab-03/helpers.js";
import * as fs from "fs";

const RUN_ID = Date.now();
const MARKER = `actions-e2e-${RUN_ID}`;

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// E2E-01 / AC-01, AC-03, AC-04, AC-06: create an Action Taken with an open
// follow-up, confirm Resolved is hidden while it's open, clear the
// follow-up, confirm Resolved becomes available and succeeds.
test("full Actions Taken flow: add with follow-up, resolution hidden, clear it, resolve", async ({ page }) => {
  // 1. Requester creates a ticket to work with.
  await loginAsUI(page, "jennifer.anderson@example.com");
  await page.getByRole("link", { name: "Create Ticket", exact: true }).click();
  await page.waitForURL("**/tickets/new");
  await page.selectOption("#categorySelect", { index: 1 });
  await page.selectOption("#relatedSystemSelect", { index: 1 });
  await page.selectOption("#prioritySelect", "MEDIUM");
  await page.fill("#summaryInput", MARKER);
  await page.fill("#descriptionInput", "A ticket created for the Lab 4 Actions Taken E2E flow.");
  await page.getByText("Submit Ticket").click();
  await expect(page.getByText(/Your ticket number is/i)).toBeVisible();
  const ticketNumber = (await page.locator("strong").last().textContent())!.trim();
  await logoutViaUI(page);

  // 2. IT Staff claims it and moves it to In Progress.
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

  // 3. Zero actions yet — Resolved must not be offered.
  await expect(page.locator("#statusSelect option", { hasText: "RESOLVED" })).toHaveCount(0);

  // 4. Switch to the Actions Taken tab (not the default) and add one with an
  // open follow-up.
  await page.getByRole("button", { name: /Actions Taken \(\d+\)/ }).click();
  await page.getByRole("button", { name: "Add Action Taken" }).click();
  await page.getByLabel("Description").fill("Diagnosed the issue.");
  await page.getByLabel("Result").fill("Needs a part from the vendor.");
  await page.getByLabel("Follow-Up Required").check();
  await page.getByLabel("Follow-up Note").fill("Call the vendor back once the part ships.");
  await page.getByRole("button", { name: "Add Action Taken" }).click();
  await expect(page.getByText("Diagnosed the issue.")).toBeVisible();
  await expect(page.getByText("Follow-up needed")).toBeVisible();

  const dir = `artifacts/lab-04/screenshots/actions-taken`;
  ensureDir(dir);
  await page.screenshot({ path: `${dir}/staff-with-follow-up.png`, fullPage: true });

  // 5. Still blocked — the open follow-up keeps Resolved hidden.
  await expect(page.locator("#statusSelect option", { hasText: "RESOLVED" })).toHaveCount(0);

  // 6. Edit the action to clear the follow-up.
  await page.getByRole("button", { name: "Edit" }).click();
  await page.getByLabel("Follow-Up Required").uncheck();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Follow-up needed")).toHaveCount(0);

  // 7. Resolved is now offered and succeeds.
  await expect(page.locator("#statusSelect option", { hasText: "RESOLVED" })).toHaveCount(1, { timeout: 10000 });
  await page.selectOption("#statusSelect", "RESOLVED");
  await expect(page.locator("#statusSelect")).toContainText("RESOLVED");
  await logoutViaUI(page);

  // 8. The Requester sees the same Action Taken, read-only.
  await loginAsUI(page, "jennifer.anderson@example.com");
  await page.getByRole("link", { name: "My Tickets", exact: true }).click();
  await page.fill('input[placeholder*="Search by ticket number"]', MARKER);
  await page.getByRole("link", { name: ticketNumber }).click();
  await page.waitForURL(/\/tickets\/\d+$/);
  await expect(page.getByText("Diagnosed the issue.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Add Action Taken" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Edit" })).toHaveCount(0);
});

// RESP-01 — Actions Taken panel at all three viewports.
const VIEWPORTS = {
  desktop: { width: 1280, height: 900 },
  tablet: { width: 900, height: 1000 },
  mobile: { width: 375, height: 812 },
} as const;

for (const [viewportName, size] of Object.entries(VIEWPORTS)) {
  test(`Actions Taken panel screenshot — ${viewportName}`, async ({ page }) => {
    await page.setViewportSize(size);

    const marker = `actions-visual-${viewportName}-${Date.now()}`;
    await loginAsUI(page, "jennifer.anderson@example.com");
    await page.getByRole("link", { name: "Create Ticket", exact: true }).click();
    await page.waitForURL("**/tickets/new");
    await page.selectOption("#categorySelect", { index: 1 });
    await page.selectOption("#relatedSystemSelect", { index: 1 });
    await page.selectOption("#prioritySelect", "MEDIUM");
    await page.fill("#summaryInput", marker);
    await page.fill("#descriptionInput", "A ticket created for the Actions Taken panel visual QA screenshot.");
    await page.getByText("Submit Ticket").click();
    await expect(page.getByText(/Your ticket number is/i)).toBeVisible();
    const ticketNumber = (await page.locator("strong").last().textContent())!.trim();
    await logoutViaUI(page);

    await loginAsUI(page, "robert.wilson@toktickit.com");
    await page.getByRole("link", { name: "Ticket Queue", exact: true }).click();
    await page.waitForURL("**/staff/queue");
    await page.fill('input[placeholder*="Search by ticket number"]', marker);
    const ticketLink =
      size.width < 768
        ? page.locator(".d-md-none.d-flex.flex-column.gap-2 a", { hasText: "TKT-" })
        : page.locator("table tbody tr a", { hasText: "TKT-" }).first();
    await ticketLink.click();
    await page.waitForURL(/\/staff\/tickets\/\d+$/);
    await page.getByRole("button", { name: /Actions Taken \(\d+\)/ }).click();
    await page.getByRole("button", { name: "Add Action Taken" }).click();
    await page.getByLabel("Description").fill("Checked the account.");
    await page.getByLabel("Result").fill("No issue found.");
    await page.getByRole("button", { name: "Add Action Taken" }).click();
    await expect(page.getByText("Checked the account.")).toBeVisible();

    const dir = "artifacts/lab-04/screenshots/actions-taken";
    ensureDir(dir);
    await page.screenshot({ path: `${dir}/staff-${viewportName}.png`, fullPage: true });
  });
}
