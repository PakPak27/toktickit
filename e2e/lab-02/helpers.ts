import { Page } from "@playwright/test";

// Selects the first available Development Requester and continues into the app.
// Used at the start of most E2E specs since every screen requires a selection.
export async function selectAnyRequester(page: Page) {
  await page.goto("/");
  await page.waitForSelector("#requesterSelect");
  const options = await page.locator("#requesterSelect option:not([disabled])").all();
  const firstValue = await options[0].getAttribute("value");
  await page.selectOption("#requesterSelect", firstValue!);
  await page.getByText("Continue →").click();
  await page.waitForURL("**/tickets");
}

export async function selectRequesterByName(page: Page, name: string) {
  await page.goto("/");
  await page.waitForSelector("#requesterSelect");
  await page.selectOption("#requesterSelect", { label: name });
  await page.getByText("Continue →").click();
  await page.waitForURL("**/tickets");
}