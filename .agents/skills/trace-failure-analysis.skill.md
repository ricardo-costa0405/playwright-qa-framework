# Skill: Trace Failure Analysis

## Purpose

Diagnose failed Playwright tests using traces, screenshots, videos, JUnit output,
and HTML reports.

## Inputs

- Failed spec or CI run
- Trace zip or artifact path
- Relevant browser/device project
- Failure message

## Rules

- Start with the Playwright error and the first failed assertion.
- Inspect trace context before changing selectors or waits.
- Prefer state-based assertions over load-state or timing waits.
- Classify the failure as selector, timing, state, network, data, environment, or product behavior.
- Update page objects for reusable fixes.
- Preserve artifacts in CI so the next failure remains diagnosable.

## Output

- Root cause summary.
- Minimal code fix or test adjustment.
- Verification command.
