# Skill: Add CI Test Suite

## Purpose

Add or update a GitHub Actions workflow for a Playwright test suite with reports,
traces, and stable artifact upload.

## Inputs

- Suite name
- npm command
- Browser or device matrix
- Required artifacts
- Pull request or scheduled trigger expectations

## Rules

- Use `npm ci --prefer-offline --no-audit`.
- Install browsers through `npm run install:browsers`.
- Set `CI: 'true'` for test runs.
- Upload JUnit, HTML report, and failure artifacts with `if: always()` where useful.
- Keep traces available through Playwright report artifacts.
- Use workflow concurrency to cancel older runs for the same PR or branch.
- Avoid adding secrets for Swag Labs tests.

## Output

- A workflow in `.github/workflows/`.
- Any required npm script updates.
- README updates describing how to run the suite locally and in CI.
