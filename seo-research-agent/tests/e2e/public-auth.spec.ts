import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("public authentication pages are usable and accessible", async ({ page }) => {
  await page.goto("/sign-in");

  await expect(page).toHaveTitle(/Sign in/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(page.getByLabel("Email")).toHaveAttribute("autocomplete", "email");
  await expect(page.getByLabel("Password")).toHaveAttribute("autocomplete", "current-password");

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);

  await Promise.all([
    page.waitForURL(/\/sign-up$/, { timeout: 30_000 }),
    page.getByRole("link", { name: "Create an account" }).click(),
  ]);
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
  await expect(page.getByText("At least 12 characters.")).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await expect(page.getByLabel("Password", { exact: true }))
    .toHaveAttribute("autocomplete", "new-password");
});

test("protected workspace redirects anonymous visitors", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/sign-in$/);
});

test("rendered pages use a nonce CSP and fit a mobile viewport", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const response = await page.goto("/sign-in");

  const policy = response?.headers()["content-security-policy"] ?? "";
  expect(policy).toContain("'strict-dynamic'");
  expect(policy).toMatch(/'nonce-[^']+'/);
  expect(policy).not.toContain("'unsafe-inline'");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

  await context.close();
});
