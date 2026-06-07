# Skill: Create E2E Test Case

## Purpose

Create a new Playwright e2e test for Swag Labs using the existing Page Object Model,
fixtures, and AAA test structure.

## Inputs

- Feature area: login, inventory, cart, checkout, product details, mobile, user variants
- Scenario summary
- Expected user-visible result
- Tags such as `@smoke`, `@cart`, `@checkout`, `@security`, or `@performance-user`

## Rules

- Use only existing Swag Labs UI behavior and browser routes.
- Do not create tests for non-existent `/api/*` endpoints.
- Prefer existing fixtures from `fixtures/saucedemo-fixtures.ts`.
- Add page-object methods before duplicating selectors across specs.
- Use data-test selectors or page-object methods.
- Keep tests deterministic and independent.
- Use AAA comments in each test body.
- Verify with `npm run validate:aaa`, `npm run validate:timeouts`, and the smallest relevant test command.

## Output

- A new or updated `*.spec.ts` file.
- Page-object updates when the interaction is reusable.
- A short verification note listing the commands run.
