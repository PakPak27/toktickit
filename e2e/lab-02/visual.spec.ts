import { test } from "@playwright/test";
import { selectAnyRequester } from "./helpers.js";
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

test.describe("Responsive visual QA (Section 8.7-8.8, tests.md RESP-01/02/03)", () => {
  for (const [viewportName, size] of Object.entries(VIEWPORTS)) {
    test(`Create Ticket screenshot — ${viewportName}`, async ({ page }) => {
      await page.setViewportSize(size);
      await selectAnyRequester(page);
      await page.getByRole("link", { name: "Create Ticket", exact: true }).click();
      await page.waitForURL("**/tickets/new");

      const dir = "artifacts/lab-02/screenshots/create-ticket";
      ensureDir(dir);
      await page.screenshot({ path: `${dir}/${viewportName}.png`, fullPage: true });
    });

    test(`My Tickets screenshot — ${viewportName}`, async ({ page }) => {
      await page.setViewportSize(size);
      await selectAnyRequester(page);
      await page.waitForURL("**/tickets");

      const dir = "artifacts/lab-02/screenshots/my-tickets";
      ensureDir(dir);
      await page.screenshot({ path: `${dir}/${viewportName}.png`, fullPage: true });
    });

    test(`Ticket Detail screenshot — ${viewportName}`, async ({ page }) => {
      await page.setViewportSize(size);
      await selectAnyRequester(page);
      await page.waitForURL("**/tickets");

      // Desktop/tablet show a <table>; mobile shows stacked <a> cards instead
      // (Bootstrap's d-none/d-md-block toggles which one is visible).
            const isMobile = size.width < 768;
      const mobileCardLinks = page.locator("div.d-md-none.d-flex.flex-column.gap-2 a");
      const hasExistingTicket = isMobile
        ? (await mobileCardLinks.count()) > 0
        : (await page.locator("table tbody tr").count()) > 0;

      if (!hasExistingTicket) {
        await page.getByRole("link", { name: "Create Ticket", exact: true }).click();
        await page.waitForURL("**/tickets/new");
        await page.selectOption("#categorySelect", { index: 1 });
        await page.selectOption("#relatedSystemSelect", { index: 1 });
        await page.selectOption("#prioritySelect", "MEDIUM");
        await page.fill("#summaryInput", "Screenshot placeholder ticket");
        await page.fill("#descriptionInput", "A sufficiently long description for this screenshot.");
        await page.getByText("Submit Ticket").click();
        await page.getByText("Go to My Tickets").click();
        await page.waitForURL("**/tickets");
      }

      if (isMobile) {
        await mobileCardLinks.first().click();
      } else {
        await page.locator("table tbody tr").first().getByRole("link").click();
      }
      await page.waitForURL(/\/tickets\/\d+$/);

      const dir = "artifacts/lab-02/screenshots/ticket-detail";
      ensureDir(dir);
      await page.screenshot({ path: `${dir}/${viewportName}.png`, fullPage: true });
    });
  }
});