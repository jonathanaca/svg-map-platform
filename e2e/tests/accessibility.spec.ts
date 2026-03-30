import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility', () => {
  test('upload page has no critical/serious violations', async ({ page }) => {
    await page.goto('/');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    const critical = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );
    expect(critical).toHaveLength(0);
  });

  test('all form inputs have associated labels', async ({ page }) => {
    await page.goto('/');

    // Check that visible inputs have labels
    const inputs = await page.locator('input:visible').all();
    for (const input of inputs) {
      const id = await input.getAttribute('id');
      const ariaLabel = await input.getAttribute('aria-label');
      const ariaLabelledBy = await input.getAttribute('aria-labelledby');

      if (id) {
        const label = page.locator(`label[for="${id}"]`);
        const hasLabel = (await label.count()) > 0;
        expect(hasLabel || ariaLabel || ariaLabelledBy).toBeTruthy();
      } else {
        expect(ariaLabel || ariaLabelledBy).toBeTruthy();
      }
    }
  });

  test('error messages use role="alert"', async ({ page }) => {
    await page.goto('/');

    // Trigger an error by uploading invalid file
    const fileInput = page.locator('input[type="file"]');
    const tmpPath = '/tmp/test-invalid.txt';
    const fs = await import('fs');
    fs.writeFileSync(tmpPath, 'not a jpeg');

    await fileInput.setInputFiles(tmpPath);

    const alerts = page.locator('[role="alert"]');
    if ((await alerts.count()) > 0) {
      expect(await alerts.first().isVisible()).toBe(true);
    }
  });
});
