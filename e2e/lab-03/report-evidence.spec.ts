import { test, expect } from "@playwright/test";
import { loginAsUI, logoutViaUI, SEED_PASSWORD } from "./helpers.js";
import * as fs from "fs";

// Dedicated, one-shot evidence-capture spec for the Lab 3 submission report.
// Not part of the regular regression suite — every screenshot here maps to a
// specific line of the labsheet's "Required Submission Evidence" table
// (Answer Part 5-8). File names are prefixed by Part number for easy lookup
// when assembling the PDF.

const DIR = "artifacts/lab-03/report-evidence";
if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });

test.describe("Part 5 - Login and Password Change UI", () => {
  test("05-01 login initial state", async ({ page }) => {
    await page.goto("/login");
    await page.waitForSelector("#email");
    await page.screenshot({ path: `${DIR}/05-01-login-initial.png` });
  });

  test("05-02 invalid credentials error", async ({ page }) => {
    await page.goto("/login");
    await page.fill("#email", "david.lee@example.com");
    await page.fill("#password", "definitely-wrong");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await page.screenshot({ path: `${DIR}/05-02-login-invalid-error.png` });
  });

  test("05-03 inactive account, identical generic error", async ({ page }) => {
    await page.goto("/login");
    await page.fill("#email", "retired.account@example.com");
    await page.fill("#password", SEED_PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await page.screenshot({ path: `${DIR}/05-03-login-inactive-error.png` });
  });

  test("05-04 login busy state", async ({ page }) => {
    await page.route("**/api/auth/login", async (route) => {
      await new Promise((r) => setTimeout(r, 1200));
      await route.continue();
    });
    await page.goto("/login");
    await page.fill("#email", "sarah.johnson@example.com");
    await page.fill("#password", SEED_PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${DIR}/05-04-login-busy.png` });
  });

  test("05-05 mandatory Change Password screen", async ({ page }) => {
    // michael.brown may already have completed the change-password flow in
    // an earlier E2E run against this same persistent dev DB (seed.ts
    // deliberately never resets mustChangePassword on an existing row, to
    // avoid clobbering a real password change) - force it back to true via
    // an Administrator password reset first, so this test is reliable no
    // matter what earlier runs left behind.
    await loginAsUI(page, "amanda.clark@toktickit.com");
    await page.getByRole("link", { name: "Users" }).click();
    await page.waitForURL("**/admin/users");
    await page.fill('input[placeholder*="Search users"]', "michael.brown");
    await page.getByRole("button", { name: "Edit user" }).click();
    await page.getByText("Set New Password").click();
    const resetPassword = await page.getByLabel("New password").inputValue();
    await page.getByText("Confirm").click();
    await expect(page.getByText(/Password reset\./)).toBeVisible();
    await page.getByLabel("Close").click();
    await logoutViaUI(page);

    await page.goto("/login");
    await page.fill("#email", "michael.brown@example.com");
    await page.fill("#password", resetPassword);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL("**/change-password");
    await page.screenshot({ path: `${DIR}/05-05-change-password-screen.png` });
    // Deliberately not submitted - loginAsUI in every other spec already
    // handles a still-mustChangePassword account on its own, so leaving
    // this account mid-flow here doesn't affect anything else.
  });

  test("05-06 authenticated app shell - Requester", async ({ page }) => {
    await loginAsUI(page, "sarah.johnson@example.com");
    await page.screenshot({ path: `${DIR}/05-06-app-shell-requester.png` });
  });

  test("05-07 authenticated app shell - IT Staff", async ({ page }) => {
    await loginAsUI(page, "emily.davis@toktickit.com");
    await page.screenshot({ path: `${DIR}/05-07-app-shell-staff.png` });
  });

  test("05-08 authenticated app shell - Administrator", async ({ page }) => {
    await loginAsUI(page, "amanda.clark@toktickit.com");
    await page.screenshot({ path: `${DIR}/05-08-app-shell-admin.png` });
  });

  test("05-09 logout returns to Login", async ({ page }) => {
    await loginAsUI(page, "david.lee@example.com");
    await logoutViaUI(page);
    await expect(page).toHaveURL(/\/login$/);
    await page.screenshot({ path: `${DIR}/05-09-logged-out.png` });
  });

  test("05-10 direct access blocked after logout", async ({ page }) => {
    await loginAsUI(page, "david.lee@example.com");
    await logoutViaUI(page);
    await page.goto("/tickets");
    await expect(page).toHaveURL(/\/login$/);
    await page.screenshot({ path: `${DIR}/05-10-blocked-after-logout.png` });
  });
});

test.describe("Part 6 - IT Staff Ticket Queue UI", () => {
  test("06-01 realistic queue data - desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await loginAsUI(page, "kevin.patel@toktickit.com");
    await page.getByRole("link", { name: "Ticket Queue" }).click();
    await page.waitForURL("**/staff/queue");
    await page.screenshot({ path: `${DIR}/06-01-queue-desktop.png`, fullPage: true });
  });

  test("06-02 search narrows results", async ({ page }) => {
    await loginAsUI(page, "kevin.patel@toktickit.com");
    await page.getByRole("link", { name: "Ticket Queue" }).click();
    await page.waitForURL("**/staff/queue");
    await page.fill('input[placeholder*="Search by ticket number"]', "TKT-2026-000001");
    await page.screenshot({ path: `${DIR}/06-02-queue-search.png`, fullPage: true });
  });

  test("06-03 filters applied", async ({ page }) => {
    await loginAsUI(page, "kevin.patel@toktickit.com");
    await page.getByRole("link", { name: "Ticket Queue" }).click();
    await page.waitForURL("**/staff/queue");
    // Filter select order on the Queue: 0=Category, 1=IT Priority, 2=Status, 3=Ownership.
    await page.locator("select").nth(1).selectOption("HIGH"); // IT Priority filter
    await page.locator("select").nth(3).selectOption("unassigned"); // Ownership filter
    await page.screenshot({ path: `${DIR}/06-03-queue-filters.png`, fullPage: true });
  });

  test("06-04 sorted by IT Priority", async ({ page }) => {
    await loginAsUI(page, "kevin.patel@toktickit.com");
    await page.getByRole("link", { name: "Ticket Queue" }).click();
    await page.waitForURL("**/staff/queue");
    // The sortable <th> carries an explicit role="button", overriding its
    // implicit columnheader role, so it must be located as a button.
    await page.getByRole("button", { name: /IT Priority/ }).click();
    await page.screenshot({ path: `${DIR}/06-04-queue-sorted.png`, fullPage: true });
  });

  test("06-05 pagination controls", async ({ page }) => {
    await loginAsUI(page, "kevin.patel@toktickit.com");
    await page.getByRole("link", { name: "Ticket Queue" }).click();
    await page.waitForURL("**/staff/queue");
    await page.getByText("Next", { exact: true }).click();
    await page.screenshot({ path: `${DIR}/06-05-queue-pagination.png`, fullPage: true });
  });

  test("06-06 no-results state", async ({ page }) => {
    await loginAsUI(page, "kevin.patel@toktickit.com");
    await page.getByRole("link", { name: "Ticket Queue" }).click();
    await page.waitForURL("**/staff/queue");
    await page.fill('input[placeholder*="Search by ticket number"]', "zzz-no-such-ticket-zzz");
    await expect(page.getByText("No tickets match your filters.")).toBeVisible();
    await page.screenshot({ path: `${DIR}/06-06-queue-no-results.png`, fullPage: true });
  });

  test("06-07 mobile card layout", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await loginAsUI(page, "kevin.patel@toktickit.com");
    await page.getByRole("link", { name: "Ticket Queue" }).click();
    await page.waitForURL("**/staff/queue");
    await page.screenshot({ path: `${DIR}/06-07-queue-mobile.png`, fullPage: true });
  });
});

test.describe("Part 7 - IT Staff Ticket Detail UI", () => {
  const marker = `report-evidence-${Date.now()}`;
  let ticketNumber = "";

  test("07-00 seed a ticket to work with", async ({ page }) => {
    await loginAsUI(page, "jennifer.anderson@example.com");
    await page.getByRole("link", { name: "Create Ticket", exact: true }).click();
    await page.waitForURL("**/tickets/new");
    await page.selectOption("#categorySelect", { index: 1 });
    await page.selectOption("#relatedSystemSelect", { index: 1 });
    await page.selectOption("#prioritySelect", "MEDIUM");
    await page.fill("#summaryInput", marker);
    await page.fill("#descriptionInput", "Ticket created for the Lab 3 submission report evidence.");
    await page.getByText("Submit Ticket").click();
    await expect(page.getByText(/Your ticket number is/i)).toBeVisible();
    ticketNumber = (await page.locator("strong").last().textContent())!.trim();
    fs.writeFileSync(`${DIR}/.ticket-number`, ticketNumber);

    // The attachment input lives on Ticket Detail, not the create-success
    // confirmation screen - navigate there first.
    await page.getByText("Go to My Tickets").click();
    await page.waitForURL("**/tickets");
    await page.fill('input[placeholder*="Search by ticket number"]', marker);
    // Both the desktop table and the mobile card list render in the DOM
    // simultaneously (CSS hides one) - scope to the visible desktop table
    // to avoid a strict-mode ambiguity between the two matching links.
    await page.locator("table tbody tr a", { hasText: "TKT-" }).first().click();
    await page.waitForURL(/\/tickets\/\d+$/);

    // Attach a file (for Attachment continuity evidence) - marking appears-
    // resolved is not possible yet (status is NEW), done after staff moves it along.
    await page.setInputFiles("#attachmentInput", {
      name: "report-evidence.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 fake pdf content for report evidence"),
    });
    await expect(page.getByText("report-evidence.pdf")).toBeVisible();
    await logoutViaUI(page);
  });

  test("07-01 ticket detail unclaimed", async ({ page }) => {
    await loginAsUI(page, "kevin.patel@toktickit.com");
    await page.getByRole("link", { name: "Ticket Queue" }).click();
    await page.waitForURL("**/staff/queue");
    await page.fill('input[placeholder*="Search by ticket number"]', marker);
    await page.locator("table tbody tr a", { hasText: "TKT-" }).first().click();
    await page.waitForURL(/\/staff\/tickets\/\d+$/);
    await page.screenshot({ path: `${DIR}/07-01-detail-unclaimed.png`, fullPage: true });
  });

  test("07-02 to 07-06 claim, priority, status, comment, note", async ({ page }) => {
    await loginAsUI(page, "kevin.patel@toktickit.com");
    await page.getByRole("link", { name: "Ticket Queue" }).click();
    await page.waitForURL("**/staff/queue");
    await page.fill('input[placeholder*="Search by ticket number"]', marker);
    await page.locator("table tbody tr a", { hasText: "TKT-" }).first().click();
    await page.waitForURL(/\/staff\/tickets\/\d+$/);

    await page.getByText("Claim for me").click();
    await expect(page.locator("#ownerSelect")).toHaveValue(/.+/, { timeout: 10000 });
    await page.screenshot({ path: `${DIR}/07-02-detail-claimed.png`, fullPage: true });

    await page.selectOption("#itPrioritySelect", "HIGH");
    await page.screenshot({ path: `${DIR}/07-03-detail-it-priority.png`, fullPage: true });

    await page.selectOption("#statusSelect", "OPEN");
    await expect(page.locator("#statusSelect")).toContainText("OPEN");
    await page.selectOption("#statusSelect", "IN_PROGRESS");
    await expect(page.locator("#statusSelect")).toContainText("IN_PROGRESS");
    await page.screenshot({ path: `${DIR}/07-04-detail-status.png`, fullPage: true });

    await page.fill('input[placeholder="Type your comment here…"]', "We are looking into this now.");
    await page.getByText("Post Comment").click();
    await expect(page.getByText("We are looking into this now.")).toBeVisible();
    await page.screenshot({ path: `${DIR}/07-05-detail-public-comment.png`, fullPage: true });

    await page.getByRole("button", { name: /Internal Notes, staff only/i }).click();
    await page.fill('input[placeholder="Type an internal note here…"]', "Vendor RMA opened, case #4471.");
    await page.getByText("Post Note").click();
    await expect(page.getByText("Vendor RMA opened, case #4471.")).toBeVisible();
    await page.screenshot({ path: `${DIR}/07-06-detail-internal-note.png`, fullPage: true });

    // Attachment continuity: the file the Requester uploaded is still here,
    // behind its own tab (not shown on the default Comments tab).
    await page.getByRole("button", { name: "Attachments", exact: true }).click();
    await expect(page.getByText("report-evidence.pdf")).toBeVisible();
    await page.screenshot({ path: `${DIR}/07-08-attachment-continuity.png`, fullPage: true });
    await logoutViaUI(page);
  });

  test("07-07 requester marks appears-resolved, staff sees the badge", async ({ page }) => {
    await loginAsUI(page, "jennifer.anderson@example.com");
    await page.getByRole("link", { name: "My Tickets", exact: true }).click();
    await page.fill('input[placeholder*="Search by ticket number"]', marker);
    await page.locator("table tbody tr a", { hasText: "TKT-" }).first().click();
    await page.waitForURL(/\/tickets\/\d+$/);
    await page.getByText("Problem Appears Resolved").click();
    await expect(page.getByText(/You indicated this appears resolved/i)).toBeVisible();
    await logoutViaUI(page);

    await loginAsUI(page, "kevin.patel@toktickit.com");
    await page.getByRole("link", { name: "Ticket Queue" }).click();
    await page.waitForURL("**/staff/queue");
    await page.fill('input[placeholder*="Search by ticket number"]', marker);
    await page.locator("table tbody tr a", { hasText: "TKT-" }).first().click();
    await page.waitForURL(/\/staff\/tickets\/\d+$/);
    await expect(page.getByText(/Requester indicated this appears resolved/i)).toBeVisible();
    await page.screenshot({ path: `${DIR}/07-07-detail-appears-resolved-badge.png`, fullPage: true });
  });
});

test.describe("Part 8 - Administrator User Management UI", () => {
  const runId = Date.now();
  const newEmail = `report-evidence-user-${runId}@toktickit.com`;

  test("08-01 user list", async ({ page }) => {
    await loginAsUI(page, "amanda.clark@toktickit.com");
    await page.getByRole("link", { name: "Users" }).click();
    await page.waitForURL("**/admin/users");
    await page.screenshot({ path: `${DIR}/08-01-user-list.png`, fullPage: true });
  });

  test("08-02 search by name or email", async ({ page }) => {
    await loginAsUI(page, "amanda.clark@toktickit.com");
    await page.getByRole("link", { name: "Users" }).click();
    await page.waitForURL("**/admin/users");
    await page.fill('input[placeholder*="Search users"]', "kevin");
    await page.screenshot({ path: `${DIR}/08-02-search.png`, fullPage: true });
  });

  test("08-03 optional role filter", async ({ page }) => {
    await loginAsUI(page, "amanda.clark@toktickit.com");
    await page.getByRole("link", { name: "Users" }).click();
    await page.waitForURL("**/admin/users");
    await page.locator("select").first().selectOption("IT_STAFF");
    await page.screenshot({ path: `${DIR}/08-03-role-filter.png`, fullPage: true });
  });

  test("08-04 duplicate email rejected", async ({ page }) => {
    await loginAsUI(page, "amanda.clark@toktickit.com");
    await page.getByRole("link", { name: "Users" }).click();
    await page.waitForURL("**/admin/users");
    await page.getByText("+ Create User").click();
    await page.fill("#nameInput", "Duplicate Email Test");
    await page.fill("#emailInput", "amanda.clark@toktickit.com");
    await page.getByText("Save User").click();
    await expect(page.getByText("This email is already in use")).toBeVisible();
    await page.screenshot({ path: `${DIR}/08-04-create-duplicate-error.png`, fullPage: true });
  });

  test("08-05 create user succeeds", async ({ page }) => {
    await loginAsUI(page, "amanda.clark@toktickit.com");
    await page.getByRole("link", { name: "Users" }).click();
    await page.waitForURL("**/admin/users");
    await page.getByText("+ Create User").click();
    await page.fill("#nameInput", "Report Evidence User");
    await page.fill("#emailInput", newEmail);
    await page.selectOption("#roleSelect", "IT_STAFF");
    await page.getByText("Save User").click();
    await expect(page.getByText("User created.")).toBeVisible();
    await page.screenshot({ path: `${DIR}/08-05-create-success.png`, fullPage: true });
  });

  test("08-06 edit user", async ({ page }) => {
    await loginAsUI(page, "amanda.clark@toktickit.com");
    await page.getByRole("link", { name: "Users" }).click();
    await page.waitForURL("**/admin/users");
    await page.fill('input[placeholder*="Search users"]', newEmail);
    await page.getByRole("button", { name: "Edit user" }).click();
    await page.fill("#nameInput", "Report Evidence User (Edited)");
    await page.screenshot({ path: `${DIR}/08-06-edit-user.png`, fullPage: true });
    await page.getByText("Save User").click();
    await expect(page.getByText("User updated.")).toBeVisible();
  });

  test("08-07 reset password forces change at next login", async ({ page }) => {
    await loginAsUI(page, "amanda.clark@toktickit.com");
    await page.getByRole("link", { name: "Users" }).click();
    await page.waitForURL("**/admin/users");
    await page.fill('input[placeholder*="Search users"]', newEmail);
    await page.getByRole("button", { name: "Edit user" }).click();
    await page.getByText("Set New Password").click();
    const generatedPassword = await page.getByLabel("New password").inputValue();
    await page.getByText("Confirm").click();
    await expect(page.getByText(/Password reset\./)).toBeVisible();
    await page.screenshot({ path: `${DIR}/08-07-reset-password.png`, fullPage: true });
    await page.getByLabel("Close").click();
    await logoutViaUI(page);

    // Demonstrate the forced change at next login, using the exact
    // Administrator-generated password (loginAsUI only knows the seed/E2E
    // passwords, not this one-off admin-reset value).
    await page.goto("/login");
    await page.fill("#email", newEmail);
    await page.fill("#password", generatedPassword);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL("**/change-password");
    await page.screenshot({ path: `${DIR}/08-07b-forced-change-at-next-login.png` });
  });

  test("08-08 self-deactivation blocked", async ({ page }) => {
    await loginAsUI(page, "amanda.clark@toktickit.com");
    await page.getByRole("link", { name: "Users" }).click();
    await page.waitForURL("**/admin/users");
    await page.fill('input[placeholder*="Search users"]', "amanda.clark");
    await page.getByRole("button", { name: "Edit user" }).click();
    await expect(page.getByLabel("Active")).toBeDisabled();
    await expect(page.getByText(/You cannot deactivate your own account/i)).toBeVisible();
    await page.screenshot({ path: `${DIR}/08-08-self-deactivate-blocked.png`, fullPage: true });
  });

  test("08-09 removing the last active Administrator is blocked", async ({ page }) => {
    // Amanda is the sole active Administrator in seed data; changing her own
    // role away from ADMINISTRATOR is the only realistic way to trigger this
    // guard (any *other* admin acting on her would imply a 2nd admin exists).
    await loginAsUI(page, "amanda.clark@toktickit.com");
    await page.getByRole("link", { name: "Users" }).click();
    await page.waitForURL("**/admin/users");
    await page.fill('input[placeholder*="Search users"]', "amanda.clark");
    await page.getByRole("button", { name: "Edit user" }).click();
    await page.selectOption("#roleSelect", "REQUESTER");
    await page.getByText("Save User").click();
    await expect(page.getByText(/Cannot remove the last active Administrator/i)).toBeVisible();
    await page.screenshot({ path: `${DIR}/08-09-last-admin-blocked.png`, fullPage: true });
  });

  test("08-10 forbidden for a non-Administrator", async ({ page }) => {
    await loginAsUI(page, "kevin.patel@toktickit.com"); // IT_STAFF
    await page.goto("/admin/users");
    await expect(page.getByText("You don't have access to this page")).toBeVisible();
    await page.screenshot({ path: `${DIR}/08-10-forbidden-non-admin.png`, fullPage: true });
  });
});
