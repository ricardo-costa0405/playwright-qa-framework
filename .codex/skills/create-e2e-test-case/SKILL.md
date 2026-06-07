# Create E2E Test Case

Use this skill when creating a new Playwright e2e test case for the Swag Labs
framework.

## Workflow

1. Confirm the scenario exists in the Swag Labs UI.
2. Choose the right suite:
   - `tests/web/specs/` for desktop browser coverage.
   - `tests/web-mobile/specs/` for mobile emulation.
   - `tests/web/specs/user-variants/` for special Swag Labs users.
3. Reuse fixtures from `fixtures/saucedemo-fixtures.ts` when possible.
4. Put reusable interactions in `pages/saucedemo/*Page.ts`.
5. Write the spec with Arrange, Act, Assert comments.
6. Verify with:
   - `npm run validate:aaa`
   - `npm run validate:timeouts`
   - the smallest relevant Playwright command

## Rules

- Do not invent `/api/*` tests for saucedemo.com.
- Prefer page-object methods over raw selectors in specs.
- Prefer `data-test` selectors, then roles, then visible text.
- Do not use `waitForTimeout`, `sleep`, or fixed timers.
- Keep tests independent and deterministic.

## Output

- Updated or new `*.spec.ts` file.
- Page-object method updates if the interaction is reusable.
- Verification commands and results.
