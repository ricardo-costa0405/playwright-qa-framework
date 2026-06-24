# Playwright Framework

[![Web Tests](https://github.com/ricardo-costa0405/playwright-qa-framework/actions/workflows/web-tests.yml/badge.svg)](https://github.com/ricardo-costa0405/playwright-qa-framework/actions/workflows/web-tests.yml)
[![Web Mobile Tests](https://github.com/ricardo-costa0405/playwright-qa-framework/actions/workflows/web-mobile-tests.yml/badge.svg)](https://github.com/ricardo-costa0405/playwright-qa-framework/actions/workflows/web-mobile-tests.yml)
[![Smoke Tests](https://github.com/ricardo-costa0405/playwright-qa-framework/actions/workflows/smoke-tests.yml/badge.svg)](https://github.com/ricardo-costa0405/playwright-qa-framework/actions/workflows/smoke-tests.yml)

End-to-end test suite for [Swag Labs](https://www.saucedemo.com) built with Playwright and TypeScript.

Covers login, inventory, cart, checkout, product details, and mobile smoke tests across Chrome, Firefox, Safari, and mobile emulation — including user-variant tests for `standard_user`, `problem_user`, and `performance_glitch_user`.

Built with the assistance of **Playwright MCP** (for browser automation and element extraction during development) and **Playwright CLI** (for test generation, debugging, and inspector workflows). See [Tooling Notes](#tooling-notes-playwright-mcp--cli) at the bottom for observations on both.

---

## Features

- Page Object Model with a shared `BasePage`
- Custom fixtures for authenticated page state (browser-aware global setup via `PW_BROWSER` env var)
- Multi-browser: Chromium, Firefox, WebKit (desktop + mobile emulation)
- User-variant specs: `standard_user`, `problem_user`, `performance_glitch_user`
- Zero hardcoded timeouts — ESLint enforces state-based waits
- AAA pattern (Arrange, Act, Assert) validated across all specs
- Four CI workflows: desktop, mobile, smoke, and retry (GitHub Actions)
- `workflow_dispatch` support on full-test workflows for manual branch validation
- JUnit + HTML + Allure reporting, failure traces, and screencasts

---

## Project Structure

```
.github/workflows/       CI pipelines (desktop, mobile, smoke, retry)
config/                  Playwright configs per platform
fixtures/                Custom Playwright fixtures (authenticated pages)
pages/                   Page Object Model
  BasePage.ts
  saucedemo/
tests/
  web/specs/             Desktop browser specs (login, inventory, cart, checkout, product details)
  web/specs/user-variants/  problem_user, performance_glitch_user specs
  web-mobile/specs/      Mobile emulation specs
utils/
  helpers/               env-manager, data-generator
  patterns/              AAA validator, timeout guard, assertion builder, anti-patterns guide
  reporters/             Failure classifier
  ai/                    Agent orchestration (generator, healer, analyzer, executor)
playwright.config.ts     Default config entry point (re-exports config/playwright.web.config.ts)
tsconfig.json            TypeScript config (must stay at root)
eslint.config.js         ESLint rules (must stay at root)
```

---

## Installation

```bash
npm install
npm run install:browsers
```

No `.env` setup needed — this framework targets Swag Labs exclusively and all defaults are pre-configured.

---

## Running Tests

| Command | Description |
|---|---|
| `npm run test:web` | Desktop tests (Chromium, Firefox, WebKit) |
| `npm run test:web-mobile` | Mobile emulation (Mobile Chrome, Mobile Safari, Galaxy S24) |
| `npm run test:all` | Desktop + mobile |
| `npm run test:smoke` | Smoke tests only (`@smoke` tag) |
| `npm run test:web:headed` | Desktop tests in headed mode |
| `npm run test:web:ui` | Interactive Playwright UI mode |
| `npm run test:web:debug` | Desktop tests in debug mode |
| `npm run test:web:debug:cli` | CLI debug mode for Playwright Agent CLI attach |
| `npm run test:web:dashboard` | Expose running tests to Playwright Agent CLI dashboard |
| `npm run test:web:trace` | Desktop tests with trace mode on |
| `npm run test:web-mobile:trace` | Mobile tests with trace mode on |
| `npm run validate:aaa` | Validate AAA pattern across all specs |
| `npm run validate:timeouts` | Scan for hardcoded timeouts |
| `npm run validate:playbooks` | Validate playbook YAML structure |
| `npm run lint` | ESLint check |

For a simple live view, use `npm run test:web:headed` or `npm run test:web:ui`.

Playwright 1.59 dashboard and CLI attach need the separate Playwright Agent CLI available on the machine. Start tests with `npm run test:web:dashboard`, then open the Agent CLI dashboard with `playwright-cli show`. For CLI debugging, start `npm run test:web:debug:cli`, copy the printed session name, and attach with `playwright-cli attach <session-name>`.

---

## Reports

```bash
npm run report:serve      # Open Playwright HTML report
npm run report:allure     # Generate and open Allure report
npm run analyze:failures  # Classify failures by root cause
```

---

## CI

Four GitHub Actions workflows run on push to `main`/`develop`, with `workflow_dispatch` available for manual branch validation on the full-test workflows:

| Workflow | Trigger | What it runs |
|---|---|---|
| `smoke-tests.yml` | PR, push to `main`/`develop` | Fast smoke pass (chromium only) — posts results as a PR comment |
| `web-tests.yml` | Push to `main`/`develop`, daily 2 AM UTC, **manual via workflow_dispatch** | Full desktop matrix: Chromium, Firefox, WebKit |
| `web-mobile-tests.yml` | Push to `main`/`develop`, daily 3 AM UTC, **manual via workflow_dispatch** | Mobile emulation: Mobile Chrome, Mobile Safari, Galaxy S24 |
| `retry-failed-tests.yml` | `workflow_run` (triggered on failed runs) | Re-runs failed jobs with extra debugging |

Key CI improvements:
- **WebKit system deps always installed** — removed cache-hit conditional on `install-deps` to prevent `libwoff2dec.so` from going missing on Ubuntu 24.04 runners
- **Explicit WebKit libraries** — `libwoff2dec1`, `libwpe`, `gstreamer` plugins installed via `apt-get` for reliable WebKit rendering
- **Node.js 24** — all actions upgraded to v5 (checkout, setup-node, cache, upload/download-artifact) for Node.js 24 compatibility
- **`workflow_dispatch`** on `web-tests.yml` and `web-mobile-tests.yml` so you can manually trigger a full run from any branch before merging

Artifacts (JUnit XML, HTML report, traces, screencasts, and failure videos) are uploaded per run. On CI retries, Playwright keeps traces for the failed attempt and its retry so flakes are easier to compare.

---

## Recent Fixes & Improvements

- **Browser-agnostic global setup** — global-setup now discovers the first available browser (chromium → firefox → webkit) instead of hardcoding chromium, making it compatible with all CI matrix jobs
- **WebKit CI reliability** — cache-busting fix ensures system deps always install, with explicit WebKit library packages for Ubuntu 24.04
- **Problem user test fix** — checkout form assertions account for Swag Labs' field-swap glitch on the `problem_user` account
- **Performance user false positive** — replaced network-request-based timing with page-level performance metrics for accurate performance_glitch_user detection
- **Fixture dependency chain** — storage state cleanup is now global and independent per user, preventing cross-contamination between spec files
- **Storage state path resolution** — `storageState` paths resolve relative to `configDir`, not `cwd`, fixing CI runner failures

---

## Tooling Notes: Playwright MCP & CLI

### Playwright CLI

Used during development for:
- `npx playwright codegen` — generates test code by recording browser interactions
- `npx playwright test --debug` / `--ui` — step-through debugging with the Inspector
- `PLAYWRIGHT_DASHBOARD=1 npx playwright test` — exposes test browsers to the Playwright 1.59 Agent CLI dashboard
- `npx playwright test --debug=cli` — pauses tests for Agent CLI attach/debug
- `npx playwright show-report` — reviewing traces and failure screenshots locally

**Pros:** Zero setup, ships with Playwright, great for quick exploration and trace review.
**Cons:** Codegen produces fragile selectors (CSS/XPath) that need manual cleanup to `data-test` attributes. The 1.59 dashboard and attach workflow need the separate Playwright Agent CLI installed locally.

### Playwright MCP

Used during development for programmatic browser control from an AI agent context:
- Extracting elements and their accessible roles/attributes to inform selector choices
- Navigating and interacting with pages to verify selectors before writing specs
- Reproducing failures in a controlled session without running the full suite

**Pros:** Allows AI-assisted element discovery with real browser context; respects the selector priority hierarchy (`data-test` → role → text) when querying. Useful for validating selectors against the live DOM before committing them to page objects.
**Cons:** Requires the MCP server running locally (`.mcp/servers.json`). Not a replacement for the test runner — used only for authoring assistance, not execution.
