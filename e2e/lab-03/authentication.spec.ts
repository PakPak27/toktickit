import { test, expect } from "@playwright/test";
import { loginAsUI, logoutViaUI, SEED_PASSWORD } from "./helpers.js";

// E2E-01 / AC-01, AC-03
test("logs in with a mustChangePassword seed account, completes the first-login change, and reaches the authenticated shell", async ({ page }) => {
  await loginAsUI(page, "david.lee@example.com");

  // Requester lands on My Tickets — the role-specific home from "/".
  await expect(page).toHaveURL(/\/tickets$/);
  await expect(page.getByText("David Lee")).toBeVisible();
});

test("shows a single generic error for an invalid password, never a raw stack trace (AC-02)", async ({ page }) => {
  await page.goto("/login");
  await page.fill("#email", "david.lee@example.com");
  await page.fill("#password", "definitely-wrong");
  await page.getByRole("button", { name: /sign in/i }).click();

  await expect(page.getByRole("alert")).toHaveText("Invalid email or password");
});

test("rejects login for an inactive account with the identical generic message (BR-01)", async ({ page }) => {
  await page.goto("/login");
  await page.fill("#email", "retired.account@example.com");
  await page.fill("#password", SEED_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();

  await expect(page.getByRole("alert")).toHaveText("Invalid email or password");
});

// E2E-02 / AC-19
test("logs out and blocks direct navigation back into a protected screen", async ({ page }) => {
  await loginAsUI(page, "sarah.johnson@example.com");
  await expect(page).toHaveURL(/\/tickets$/);

  await logoutViaUI(page);
  await expect(page).toHaveURL(/\/login$/);

  // Reusing the browser session (cookie cleared server-side on logout) to
  // hit a protected URL directly must bounce straight back to Login —
  // never render the My Tickets screen first.
  await page.goto("/tickets");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "My Tickets" })).toHaveCount(0);
});
