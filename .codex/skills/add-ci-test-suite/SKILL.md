# Add CI Test Suite

Use this skill when adding or updating GitHub Actions coverage for Playwright
tests in this repository.

## Workflow

1. Define the local npm command first.
2. Add or update the workflow in `.github/workflows/`.
3. Use a browser or device matrix only when it provides meaningful coverage.
4. Set `CI: 'true'` for test execution.
5. Upload reports and failure artifacts.
6. Validate the workflow-adjacent scripts locally where possible.

## Rules

- Use `npm ci --prefer-offline --no-audit`.
- Install browsers with `npm run install:browsers`.
- Use workflow concurrency:
  `group: <suite>-${{ github.event.pull_request.number || github.ref }}`
- Upload JUnit XML and HTML reports with `if: always()`.
- Preserve traces through Playwright report artifacts.
- Do not add secrets for Swag Labs tests.

## Output

- CI workflow file.
- npm script updates if needed.
- README or docs updates explaining the suite.
