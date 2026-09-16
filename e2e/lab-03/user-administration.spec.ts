import { test, expect } from "@playwright/test";
import { loginAsUI } from "./helpers.js";

const RUN_ID = Date.now();
const NEW_EMAIL = `e2e-admin-user-${RUN_ID}@toktickit.com`;

// E2E-04 / AC-15, AC-16, AC-17
test("full Administrator flow: create (duplicate rejected, then unique succeeds), edit, reset password, self-deactivation blocked", async ({ page }) => {
  await loginAsUI(page, "amanda.clark@toktickit.com");
  await page.getByRole("link", { name: "Users" }).click();
  await page.waitForURL("**/admin/users");

  // 1. Duplicate email is rejected inline.
  await page.getByText("+ Create User").click();
  await page.fill("#nameInput", "Duplicate Email User");
  await page.fill("#emailInput", "amanda.clark@toktickit.com");
  await page.getByText("Save User").click();
  await expect(page.getByText("This email is already in use")).toBeVisible();

  // 2. A unique email succeeds — the form closes itself on success.
  await page.fill("#emailInput", NEW_EMAIL);
  await page.selectOption("#roleSelect", "IT_STAFF");
  await page.getByText("Save User").click();
  await expect(page.getByText("User created.")).toBeVisible();

  // 3. Edit the new user — "Edit user" (the aria-label) avoids matching the
  // "Edit User" modal heading, which getByText("Edit") ambiguously would.
  await page.fill('input[placeholder*="Search users"]', NEW_EMAIL);
  await page.getByRole("button", { name: "Edit user" }).click();
  await page.fill("#nameInput", "Renamed E2E User");
  await page.getByText("Save User").click();
  await expect(page.getByText("User updated.")).toBeVisible();

  // 4. Reset the new user's password, then explicitly close the panel —
  // unlike Save, a password reset doesn't close the form on its own.
  await page.fill('input[placeholder*="Search users"]', NEW_EMAIL);
  await page.getByRole("button", { name: "Edit user" }).click();
  await page.getByText("Set New Password").click();
  await page.getByText("Confirm").click();
  await expect(page.getByText(/Password reset\./)).toBeVisible();
  await page.getByLabel("Close").click();

  // 5. Amanda cannot deactivate her own account — the toggle is disabled.
  await page.fill('input[placeholder*="Search users"]', "amanda.clark");
  await page.getByRole("button", { name: "Edit user" }).click();
  await expect(page.getByLabel("Active")).toBeDisabled();
  await expect(page.getByText(/You cannot deactivate your own account/i)).toBeVisible();
});
