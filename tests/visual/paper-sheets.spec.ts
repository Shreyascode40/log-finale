import { expect, test } from "@playwright/test";

test("each demo sheet matches its screen and print rendering", async ({ page }) => {
  await page.goto("/demo/paper");
  const screenSheet = page.locator(".paper-page");

  for (let index = 0; index < 2; index += 1) {
    await expect(screenSheet).toHaveCSS("width", "794px");
    await expect(screenSheet).toHaveCSS("height", "1123px");
    await expect(screenSheet).toHaveScreenshot(`parity-page-${index + 1}.png`, {
      maxDiffPixelRatio: 0.02,
    });
    if (index === 0) await page.getByRole("button", { name: "Next" }).click();
  }

  await page.goto("/demo/paper?print=1");
  const printSheets = page.locator(".paper-page");
  await expect(printSheets).toHaveCount(2);
  for (let index = 0; index < 2; index += 1) {
    await expect(printSheets.nth(index)).toHaveCSS("width", "794px");
    await expect(printSheets.nth(index)).toHaveCSS("height", "1123px");
    await expect(printSheets.nth(index)).toHaveScreenshot(`parity-page-${index + 1}.png`, {
      maxDiffPixelRatio: 0.02,
    });
  }
});
