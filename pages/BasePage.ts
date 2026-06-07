import { Page, Locator, expect } from '@playwright/test';

/**
 * Base Page Object following Clean Code and AAA-ready design
 *
 * RULES:
 * - Single Responsibility: Each page = one class
 * - No business logic in pages
 * - State-based waits only (NO timeouts)
 * - Meaningful method names
 * - Return types for chainability
 */
export abstract class BasePage {
  protected page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  protected abstract getUrl(): string;

  protected abstract verifyPageLoaded(): Promise<void>;

  async navigate(url?: string): Promise<void> {
    const targetUrl = url || this.getUrl();
    await this.page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
    await this.verifyPageLoaded();
  }

  /**
   * ANTI-PATTERN: await element.click(); await page.waitForTimeout(1000);
   * CORRECT: Click and verify resulting state
   */
  protected async clickAndWait(selector: string): Promise<void> {
    const element = this.page.locator(selector);
    await expect(element).toBeVisible();
    await expect(element).toBeEnabled();
    await element.click();
  }

  protected async clickAndNavigate(
    selector: string,
    expectedUrl: RegExp | string
  ): Promise<void> {
    const element = this.page.locator(selector);
    await expect(element).toBeVisible();
    await expect(element).toBeEnabled();
    await element.click();
    await expect(this.page).toHaveURL(expectedUrl);
  }

  protected async clickAndExpectVisible(
    selector: string,
    targetSelector: string
  ): Promise<void> {
    await this.clickAndWait(selector);
    await expect(this.page.locator(targetSelector)).toBeVisible();
  }

  protected async fillInput(
    selector: string,
    value: string,
    shouldVerify: boolean = true
  ): Promise<void> {
    const input = this.page.locator(selector);
    await expect(input).toBeVisible();
    await expect(input).toBeEditable();
    await input.clear();
    await input.fill(value);

    if (shouldVerify) {
      await expect(input).toHaveValue(value);
    }
  }

  protected async typeText(selector: string, text: string): Promise<void> {
    const input = this.page.locator(selector);
    await expect(input).toBeVisible();
    await expect(input).toBeEditable();
    await input.pressSequentially(text, { delay: 50 });
  }

  protected async selectOption(
    selector: string,
    option: string | { label?: string; value?: string; index?: number }
  ): Promise<void> {
    const select = this.page.locator(selector);
    await expect(select).toBeVisible();
    await expect(select).toBeEnabled();
    await select.selectOption(option);

    const selectedValue = await select.inputValue();
    if (!selectedValue) {
      throw new Error('Selection did not result in a value');
    }
  }

  /** Wait for element state — replaces waitForTimeout */
  protected async waitForElement(
    selector: string,
    state: 'visible' | 'hidden' | 'attached' | 'detached' = 'visible'
  ): Promise<void> {
    const element = this.page.locator(selector);

    switch (state) {
      case 'visible':
        await expect(element).toBeVisible();
        break;
      case 'hidden':
        await expect(element).toBeHidden();
        break;
      case 'attached':
        await expect(element).toBeAttached();
        break;
      case 'detached':
        await expect(element).not.toBeAttached();
        break;
    }
  }

  /**
   * Wait for API call to complete — uses Playwright's waitForResponse,
   * no hardcoded timer.
   */
  protected async waitForAPICall(
    urlPattern: string | RegExp,
    method?: string
  ): Promise<import('@playwright/test').Response> {
    return this.page.waitForResponse((response) => {
      const matchesUrl =
        typeof urlPattern === 'string'
          ? response.url().includes(urlPattern)
          : urlPattern.test(response.url());
      const matchesMethod = !method || response.request().method() === method;
      return matchesUrl && matchesMethod && response.ok();
    });
  }

  protected async getText(selector: string): Promise<string> {
    const element = this.page.locator(selector);
    await expect(element).toBeVisible();
    const text = await element.textContent();
    return text?.trim() || '';
  }

  protected async getTextList(selector: string): Promise<string[]> {
    const texts = await this.page.locator(selector).allTextContents();
    return texts.map((t) => t.trim()).filter(Boolean);
  }

  /**
   * Non-retrying, non-throwing probe — use for conditional logic only,
   * not as a test assertion.
   */
  protected async isElementVisible(selector: string): Promise<boolean> {
    return this.page.locator(selector).isVisible();
  }

  protected locator(selector: string): Locator {
    return this.page.locator(selector);
  }

  protected async evaluateScript<T>(
    expression: string,
    arg?: Record<string, unknown>
  ): Promise<T> {
    return this.page.evaluate<T>(expression, arg);
  }

  async takeScreenshot(name: string): Promise<Buffer> {
    return this.page.screenshot({ path: `screenshots/${name}.png` });
  }

  async getCurrentUrl(): Promise<string> {
    return this.page.url();
  }

  async getPageTitle(): Promise<string> {
    return this.page.title();
  }
}
