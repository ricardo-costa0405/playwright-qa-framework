# Playwright Quality Bundle

Use this bundle when an agent needs the complete quality context for this
Playwright framework.

## Included Skills

- `create-e2e-test-case`
- `add-ci-test-suite`
- `trace-failure-analysis`

## Workflow

1. Pick the narrowest skill that matches the task.
2. Apply the project rules before generating tests or CI changes.
3. Use the relevant playbook from `.agents/playbooks/` for staged work.
4. Run the required validation commands before finalizing changes.

## Rules

- Swag Labs is a static React SPA.
- The framework should not create API tests for invented `/api/*` endpoints.
- E2E coverage should focus on real UI behavior, browser routes, and DOM state.
- Security-oriented coverage should focus on UI inputs, protected route redirects,
  logout/session clearing, and safe rendering of harmless payloads.
- Performance coverage is currently limited to `performance_glitch_user` and
  simple SLA-style e2e timing assertions.

## Verification

Run these before finalizing agent-generated changes:

```bash
npm run validate:playbooks
npm run validate:aaa
npm run validate:timeouts
npm run type-check
```
