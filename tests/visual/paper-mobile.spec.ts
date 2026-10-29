import { expect, test } from "@playwright/test";

test("mobile viewer scales a fixed A4 sheet without reflow", async ({ page }) => {
  await page.goto("/demo/paper");
  const metrics = await page.locator(".paper-page").evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return { renderedWidth: bounds.width, layoutWidth: (element as HTMLElement).offsetWidth };
  });

  expect(metrics.layoutWidth).toBe(794);
  expect(metrics.renderedWidth).toBeLessThan(794);
  expect(metrics.renderedWidth).toBeGreaterThan(300);
});
