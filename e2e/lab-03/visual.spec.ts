import { test } from "@playwright/test";
import { loginAsUI, logoutViaUI } from "./helpers.js";
import * as fs from "fs";

const VIEWPORTS = {
  desktop: { width: 1280, height: 900 },
  tablet: { width: 900, height: 1000 },
  mobile: { width: 375, height: 812 },
} as const;

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

test.describe("Responsive visual QA (ui-spec.md §11, tests.md RESP-01)", () => {
  for (const [viewportName, size] of Object.entries(VIEWPORTS)) {
    test(`Login screenshot — ${viewportName}`, async ({ page }) => {
      await page.setViewportSize(size);
      await page.goto("/login");
      await page.waitForSelector("#email");

      const dir = "artifacts/lab-03/screenshots/authentication";
      ensureDir(dir);
      await page.screenshot({ path: `${dir}/login-${viewportName}.png`, fullPage: true });
    });

    test(`Ticket Queue screenshot — ${viewportName}`, async ({ page }) => {
      await page.setViewportSize(size);
      await loginAsUI(page, "emily.davis@toktickit.com");
      await page.getByRole("link", { name: "Ticket Queue" }).click();
      await page.waitForURL("**/staff/queue");

      const dir = "artifacts/lab-03/screenshots/staff-queue";
      ensureDir(dir);
      await page.screenshot({ path: `${dir}/${viewportName}.png`, fullPage: true });
      await logoutViaUI(page);
    });

    test(`Staff Ticket Detail screenshot — ${viewportName}`, async ({ page }) => {
      // Self-contained: create a ticket as a Requester, then open it as staff,
      // so this test doesn't depend on data from another spec file.
      await page.setViewportSize(size);

      const marker = `visual-qa-${viewportName}-${Date.now()}`;
      await loginAsUI(page, "jennifer.anderson@example.com");
      await page.getByRole("link", { name: "Create Ticket", exact: true }).click();
      await page.waitForURL("**/tickets/new");
      await page.selectOption("#categorySelect", { index: 1 });
      await page.selectOption("#relatedSystemSelect", { index: 1 });
      await page.selectOption("#prioritySelect", "MEDIUM");
      await page.fill("#summaryInput", marker);
      await page.fill("#descriptionInput", "A ticket created for the Staff Ticket Detail visual QA screenshot.");
      await page.getByText("Submit Ticket").click();
      await page.getByText(/Ticket created successfully/i).waitFor();
      await logoutViaUI(page);

      await loginAsUI(page, "robert.wilson@toktickit.com");
      await page.getByRole("link", { name: "Ticket Queue" }).click();
      await page.waitForURL("**/staff/queue");
      await page.fill('input[placeholder*="Search by ticket number"]', marker);
      // Desktop <table> row link and mobile card link both match "TKT-" —
      // only one is visible per viewport (Bootstrap d-none/d-md-block), so
      // this loop (unlike the mobile-only requester-regression spec) has to
      // pick the locator conditionally rather than always using one.
      const ticketLink =
        size.width < 768
          ? page.locator(".d-md-none.d-flex.flex-column.gap-2 a", { hasText: "TKT-" })
          : page.locator("table tbody tr a", { hasText: "TKT-" }).first();
      await ticketLink.click();
      await page.waitForURL(/\/staff\/tickets\/\d+$/);

      const dir = "artifacts/lab-03/screenshots/staff-ticket-detail";
      ensureDir(dir);
      await page.screenshot({ path: `${dir}/${viewportName}.png`, fullPage: true });
    });

    test(`User Management screenshot — ${viewportName}`, async ({ page }) => {
      await page.setViewportSize(size);
      await loginAsUI(page, "amanda.clark@toktickit.com");
      await page.getByRole("link", { name: "Users" }).click();
      await page.waitForURL("**/admin/users");

      const dir = "artifacts/lab-03/screenshots/user-management";
      ensureDir(dir);
      await page.screenshot({ path: `${dir}/${viewportName}.png`, fullPage: true });
    });
  }
});
