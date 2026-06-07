# Agent Playbooks

This repository uses agent playbooks to standardize how new tests, CI suites, and
trace analysis are created.

## Structure

- `.agents/rules/` contains non-negotiable quality rules.
- `.agents/skills/` contains registry metadata for reusable agent capabilities.
- `.agents/playbooks/` contains ordered pipelines that combine rules and skills.
- `.codex/skills/` contains Codex CLI skills in the `SKILL.md` format used by
  playbooks-style skill directories.
- `utils/agents/validate-playbooks.ts` validates the structure in CI.

## Available Pipelines

- `new-test-case-pipeline`: create a new Swag Labs e2e scenario.
- `ci-and-traces-pipeline`: add or maintain CI execution and trace artifacts.
- `security-test-discovery-pipeline`: propose security-oriented UI tests for the
  static Swag Labs app.

## Codex Skills

- `.codex/skills/create-e2e-test-case/SKILL.md`
- `.codex/skills/add-ci-test-suite/SKILL.md`
- `.codex/skills/trace-failure-analysis/SKILL.md`
- `.codex/skills/playwright-quality-bundle/SKILL.md`

## Local Commands

```bash
npm run validate:playbooks
npm run test:web:trace
npm run test:web-mobile:trace
```

`test:web:trace` and `test:web-mobile:trace` set `PW_TRACE_MODE=on` so every test
captures a trace locally. The default CI behavior remains `retain-on-failure`.

## Scope Note

Swag Labs is a static React SPA. Do not create API test cases for invented
`/api/*` endpoints. Security-oriented tests should focus on UI inputs, protected
route redirects, logout/session clearing, and safe rendering of harmless payloads.
