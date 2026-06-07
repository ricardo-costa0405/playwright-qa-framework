# Trace Failure Analysis

Use this skill when diagnosing failed Playwright tests from local runs or CI.

## Workflow

1. Start with the failed assertion and Playwright error.
2. Open the trace or HTML report before changing code.
3. Classify the failure:
   - selector
   - timing
   - state
   - data
   - environment
   - product behavior
4. Fix the smallest durable cause.
5. Prefer page-object updates when multiple tests use the same interaction.
6. Re-run the focused test and relevant validators.

## Rules

- Do not add fixed waits to hide timing issues.
- Use retried locator assertions for readiness.
- Keep screenshots, videos, traces, JUnit, and HTML reports available in CI.
- Use `PW_TRACE_MODE=on` only when full local trace capture is needed.

## Output

- Root cause summary.
- Minimal code or test fix.
- Verification command and result.
