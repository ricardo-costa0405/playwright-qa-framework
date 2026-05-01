import { test, expect } from '../../../fixtures/saucedemo-fixtures';

const SELECTORS = {
  inventoryItem: '[data-test="inventory-item"]',
  inventoryItemName: '[data-test="inventory-item-name"]',
  inventoryItemPrice: '[data-test="inventory-item-price"]',
  inventoryItemDescription: '[data-test="inventory-item-desc"]',
  inventoryList: '[data-test="inventory-list"]',
  productImage: '.inventory_item_img img',
  detailsImage: '.inventory_details_img',
  detailsContainer: '.inventory_details_desc_container',
  addToCart: '[data-test="add-to-cart"]',
  remove: '[data-test="remove"]',
  cartBadge: '[data-test="shopping-cart-badge"]',
  backToProducts: '[data-test="back-to-products"]',
} as const;

async function openProductDetails(page: import('@playwright/test').Page, index = 0): Promise<void> {
  const productName = page.locator(SELECTORS.inventoryItemName).nth(index);
  await expect(productName).toBeVisible();
  await productName.click();
  await expect(page).toHaveURL(/inventory-item/);
  await expect(page.locator(SELECTORS.inventoryItem)).toBeVisible();
}

/**
 * Swag Labs — Product Details Feature Tests @product-details
 *
 * Covers:
 *   ✓ Clicking product image navigates to product detail page
 *   ✓ Clicking product name navigates to product detail page
 *   ✓ Product detail page displays all required information
 *   ✓ Product images load successfully on detail page
 *   ✓ Add to cart from detail page works correctly
 *   ✓ Back to inventory from detail page works correctly
 *   ✓ Remove from cart on detail page works correctly
 *   ✓ Product description is displayed and readable
 *
 * Anti-patterns enforced → AAA pattern compliance
 *
 * Note: Product detail page shows individual product information
 * with additional features like full description and image gallery.
 */

test.describe('Product Details Feature @product-details', () => {

  // ─── Navigation to product details ───────────────────────────────────────

  test('clicking product image navigates to product details', async ({
    inventoryPage: _inventoryPage,
    page,
  }) => {
    // ==================== ARRANGE ====================
    const productImage = page.locator(SELECTORS.productImage).first();
    await expect(productImage).toBeVisible();

    // ==================== ACT ====================
    await productImage.click();

    // ==================== ASSERT ====================
    await expect(page).toHaveURL(/inventory-item/);
    await expect(page.locator(SELECTORS.inventoryItem)).toBeVisible();
    await expect(page.locator(SELECTORS.detailsContainer)).toBeVisible();
  });

  test('clicking product name navigates to product details', async ({
    inventoryPage: _inventoryPage,
    page,
  }) => {
    // ==================== ARRANGE ====================
    const productName = page.locator(SELECTORS.inventoryItemName).first();
    await expect(productName).toBeVisible();

    // ==================== ACT ====================
    await productName.click();

    // ==================== ASSERT ====================
    await expect(page).toHaveURL(/inventory-item/);
    await expect(page.locator(SELECTORS.inventoryItem)).toBeVisible();
  });

  test('product detail page displays product name and price', async ({
    inventoryPage: _inventoryPage,
    page,
  }) => {
    // ==================== ARRANGE ====================
    const productName = await page
      .locator(SELECTORS.inventoryItemName)
      .first()
      .innerText();

    // ==================== ACT ====================
    await openProductDetails(page);

    // ==================== ASSERT ====================
    await expect(page.locator(SELECTORS.inventoryItemName)).toHaveText(productName);

    await expect(page.locator(SELECTORS.inventoryItemPrice)).toContainText(/\$[\d.]+/);
  });

  test('product detail image loads successfully', async ({
    inventoryPage: _inventoryPage,
    page,
  }) => {
    // ==================== ARRANGE ====================
    await openProductDetails(page);

    // ==================== ACT ====================
    // .inventory_details_img IS the <img> element — do not chain >> img into it
    const detailImage = page.locator(SELECTORS.detailsImage);

    // ==================== ASSERT ====================
    await expect(detailImage).toBeVisible();
    await expect(detailImage).toHaveCount(1);

    const src = await detailImage.getAttribute('src');
    expect(src).toBeTruthy();
    expect(src).not.toBe('');
  });

  test('product detail displays full description', async ({
    inventoryPage: _inventoryPage,
    page,
  }) => {
    // ==================== ARRANGE ====================
    await openProductDetails(page);

    // ==================== ACT ====================
    const description = page.locator(SELECTORS.inventoryItemDescription);

    // ==================== ASSERT ====================
    await expect(description).toBeVisible();
    await expect(description).toContainText(/\w{10,}/);
  });

  // ─── Add to cart from product details ─────────────────────────────────────

  test('add to cart button on detail page adds item correctly', async ({
    inventoryPage: _inventoryPage,
    page,
  }) => {
    // ==================== ARRANGE ====================
    await openProductDetails(page);

    // ==================== ACT ====================
    await page.locator(SELECTORS.addToCart).click();

    // ==================== ASSERT ====================
    // Button should change to "Remove"
    await expect(page.locator(SELECTORS.remove)).toBeVisible();
    await expect(page.locator(SELECTORS.cartBadge)).toHaveText('1');
  });

  test('remove from cart button on detail page removes item correctly', async ({
    inventoryPage: _inventoryPage,
    page,
  }) => {
    // ==================== ARRANGE ====================
    await openProductDetails(page);

    await page.locator(SELECTORS.addToCart).click();
    await expect(page.locator(SELECTORS.remove)).toBeVisible();

    // ==================== ACT ====================
    await page.locator(SELECTORS.remove).click();

    // ==================== ASSERT ====================
    await expect(page.locator(SELECTORS.addToCart)).toBeVisible();
    await expect(page.locator(SELECTORS.cartBadge)).toBeHidden();
  });

  // ─── Navigation from product details ──────────────────────────────────────

  test('back button returns to inventory from product details', async ({
    inventoryPage: _inventoryPage,
    page,
  }) => {
    // ==================== ARRANGE ====================
    await openProductDetails(page);

    // ==================== ACT ====================
    await page.locator(SELECTORS.backToProducts).click();

    // ==================== ASSERT ====================
    await expect(page).toHaveURL(/inventory\.html/);
    await expect(page.locator(SELECTORS.inventoryList)).toBeVisible();
  });

  // ─── Multiple product details navigation ───────────────────────────────────

  test('can navigate between different product details', async ({
    inventoryPage: _inventoryPage,
    page,
  }) => {
    // ==================== ARRANGE ====================
    const firstProductName = await page.locator(SELECTORS.inventoryItemName).nth(0).innerText();

    // ==================== ACT ====================
    await openProductDetails(page, 0);

    await page.locator(SELECTORS.backToProducts).click();
    await expect(page).toHaveURL(/inventory\.html/);

    const secondProductName = await page.locator(SELECTORS.inventoryItemName).nth(1).innerText();

    await openProductDetails(page, 1);

    // ==================== ASSERT ====================
    await expect(page.locator(SELECTORS.inventoryItemName)).toHaveText(secondProductName);
    await expect(page.locator(SELECTORS.inventoryItemName)).not.toHaveText(firstProductName);
  });

  test('cart state persists when navigating between product details', async ({
    inventoryPage: _inventoryPage,
    page,
  }) => {
    // ==================== ARRANGE ====================
    await openProductDetails(page, 0);
    await page.locator(SELECTORS.addToCart).click();
    await expect(page.locator(SELECTORS.cartBadge)).toHaveText('1');

    // ==================== ACT ====================
    await page.locator(SELECTORS.backToProducts).click();
    await openProductDetails(page, 1);

    // ==================== ASSERT ====================
    await expect(page.locator(SELECTORS.cartBadge)).toHaveText('1');

    await page.locator(SELECTORS.addToCart).click();
    await expect(page.locator(SELECTORS.cartBadge)).toHaveText('2');
  });

  test('product detail page shows correct add/remove button state based on cart', async ({
    inventoryPage: _inventoryPage,
    page,
  }) => {
    // ==================== ARRANGE ====================
    await openProductDetails(page);

    // ==================== ACT ====================
    let button = page.locator(SELECTORS.addToCart);

    // ==================== ASSERT ====================
    await expect(button).toBeVisible();

    await button.click();
    button = page.locator(SELECTORS.remove);
    await expect(button).toBeVisible();

    await button.click();
    button = page.locator(SELECTORS.addToCart);
    await expect(button).toBeVisible();
  });

});
