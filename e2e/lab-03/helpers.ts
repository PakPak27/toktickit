import { Page, request as pwRequest } from "@playwright/test";

// All seeded accounts share this local-dev-only initial password
// (specification.md §5.6). The very first time an E2E run logs an account
// in, it completes the mandatory first-login password change and settles
// the account onto E2E_PASSWORD — every later run (and every other spec in
// the same run) then logs in directly with E2E_PASSWORD, so the suite is
// idempotent across repeated `npx playwright test` invocations without a
// database reset.
export const SEED_PASSWORD = "ChangeMe123!";
export const E2E_PASSWORD = "E2eTestPass1!";

async function resolvePassword(email: string): Promise<string> {
  const ctx = await pwRequest.newContext({ baseURL: "http://localhost:3000" });
  try {
    const res = await ctx.post("/api/auth/login", { data: { email, password: E2E_PASSWORD } });
    return res.ok() ? E2E_PASSWORD : SEED_PASSWORD;
  } finally {
    await ctx.dispose();
  }
}

// Logs in through the real UI, completing the mandatory first-login
// password change if this account lands there. Leaves the page on whatever
// screen the app lands the user on (role-specific home via "/").
export async function loginAsUI(page: Page, email: string): Promise<void> {
  const password = await resolvePassword(email);

  await page.goto("/login");
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.getByRole("button", { name: /sign in/i }).click();

  // Branch on the *actual* post-login destination rather than assuming it
  // from which password worked — mustChangePassword and passwordHash can
  // be out of sync for a seeded account (e.g. a prior test run cleared the
  // flag directly without changing the password), so this stays correct
  // regardless of the account's real state.
  await page.waitForURL((url) => !url.pathname.includes("/login"));
  if (page.url().includes("/change-password")) {
    await page.fill("#currentPassword", password);
    await page.fill("#newPassword", E2E_PASSWORD);
    await page.fill("#confirmPassword", E2E_PASSWORD);
    await page.getByRole("button", { name: /continue/i }).click();
    await page.waitForURL((url) => !url.pathname.includes("/change-password"));
  }
}

export async function logoutViaUI(page: Page): Promise<void> {
  await page.getByRole("button", { name: /logout/i }).click();
  await page.waitForURL("**/login");
}
