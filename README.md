# Playwright Framework

[![Web Tests](https://github.com/ricardo-costa0405/playwright-qa-framework/actions/workflows/web-tests.yml/badge.svg)](https://github.com/ricardo-costa0405/playwright-qa-framework/actions/workflows/web-tests.yml)
[![Web Mobile Tests](https://github.com/ricardo-costa0405/playwright-qa-framework/actions/workflows/web-mobile-tests.yml/badge.svg)](https://github.com/ricardo-costa0405/playwright-qa-framework/actions/workflows/web-mobile-tests.yml)
[![Smoke Tests](https://github.com/ricardo-costa0405/playwright-qa-framework/actions/workflows/smoke-tests.yml/badge.svg)](https://github.com/ricardo-costa0405/playwright-qa-framework/actions/workflows/smoke-tests.yml)

End-to-end test suite for [Swag Labs](https://www.saucedemo.com) built with Playwright and TypeScript.

Covers login, inventory, cart, checkout, product details, and mobile smoke tests across Chrome, Firefox, and Safari.

This framework was built with the assistance of **Playwright MCP** (for browser automation and element extraction during development) and **Playwright CLI** (for test generation, debugging, and inspector workflows). See [Tooling Notes](#tooling-notes-playwright-mcp--cli) at the bottom for observations on both.

---

## Features

- Page Object Model with a shared `BasePage`
- Custom fixtures for authenticated page state
- Multi-browser: Chromium, Firefox, WebKit (desktop + mobile emulation)
- Zero hardcoded timeouts — ESLint enforces state-based waits
- AAA pattern (Arrange, Act, Assert) validated across all specs
- Three CI workflows: desktop, mobile, smoke (GitHub Actions)
- JUnit + HTML + Allure reporting

---

## Project Structure

```
.github/workflows/       CI pipelines (desktop, mobile, smoke)
config/                  Playwright configs per platform
fixtures/                Custom Playwright fixtures (authenticated pages)
pages/                   Page Object Model
  BasePage.ts
  saucedemo/
tests/
  web/specs/             Desktop browser specs
  web-mobile/specs/      Mobile emulation specs
utils/
  helpers/               env-manager, data-generator
  patterns/              AAA validator, timeout guard, assertion builder
  reporters/             Failure classifier
  ai/                    Agent orchestration (generator, healer, analyzer)
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
| `npm run test:web-mobile` | Mobile emulation (Pixel 5, iPhone 13, Galaxy S24) |
| `npm run test:all` | Desktop + mobile |
| `npm run test:smoke` | Smoke tests only (`@smoke` tag) |
| `npm run test:web:headed` | Desktop tests in headed mode |
| `npm run test:web:ui` | Interactive Playwright UI mode |
| `npm run test:web:debug` | Desktop tests in debug mode |
| `npm run test:web:debug:cli` | CLI debug mode for Playwright Agent CLI attach |
| `npm run test:web:dashboard` | Expose running tests to Playwright Agent CLI dashboard |

For a simple live view, use `npm run test:web:headed` or `npm run test:web:ui`.

Playwright 1.59 dashboard and CLI attach need the separate Playwright Agent CLI available on the machine. Start tests with `npm run test:web:dashboard`, then open the Agent CLI dashboard with `playwright-cli show`. For CLI debugging, start `npm run test:web:debug:cli`, copy the printed session name, and attach with `playwright-cli attach <session-name>`.

---

## Reports

```bash
npm run report:serve      # Open Playwright HTML report
npm run report:allure     # Generate and open Allure report
```

## CI

Three GitHub Actions workflows run on push and pull requests to `main`:

- `web-tests.yml` — desktop browsers, matrix across Chromium, Firefox, WebKit
- `web-mobile-tests.yml` — mobile device emulation (Pixel 5, iPhone 13, Galaxy S24)
- `smoke-tests.yml` — fast smoke pass, posts results as a PR comment

Artifacts (JUnit XML, HTML report, traces, and failure videos) are uploaded per run. On CI retries, Playwright keeps traces for the failed attempt and its retry so flakes are easier to compare.

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
// Test: E2E flow verification - Mon Jun 15 18:41:44 UTC 2026
