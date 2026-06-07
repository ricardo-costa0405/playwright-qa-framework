import { existsSync, readdirSync, readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

type PipelineStage = {
  id: string;
  name: string;
  required: boolean;
  checks: string[];
};

type Pipeline = {
  id: string;
  version: string;
  description: string;
  rules: string[];
  skills: string[];
  stages: PipelineStage[];
};

type RuleSet = {
  id: string;
  version: string;
  scope: string;
  rules: Array<{
    id: string;
    severity: string;
    description: string;
  }>;
};

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);
const rootDir = path.resolve(dirname, '../..');
const agentsDir = path.join(rootDir, '.agents');
const codexSkillsDir = path.join(rootDir, '.codex/skills');
const playbooksDir = path.join(agentsDir, 'playbooks');
const rulesDir = path.join(agentsDir, 'rules');
const skillsDir = path.join(agentsDir, 'skills');

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, 'utf8')) as T;
}

function assertCondition(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function validateDirectories(): void {
  for (const dirPath of [agentsDir, codexSkillsDir, playbooksDir, rulesDir, skillsDir]) {
    assertCondition(existsSync(dirPath), `Missing required directory: ${dirPath}`);
  }
}

function validateRuleSet(filePath: string): void {
  const ruleSet = readJson<RuleSet>(filePath);

  assertCondition(Boolean(ruleSet.id), `${filePath}: missing id`);
  assertCondition(Boolean(ruleSet.version), `${filePath}: missing version`);
  assertCondition(Boolean(ruleSet.scope), `${filePath}: missing scope`);
  assertCondition(Array.isArray(ruleSet.rules), `${filePath}: rules must be an array`);
  assertCondition(ruleSet.rules.length > 0, `${filePath}: rules must not be empty`);

  for (const rule of ruleSet.rules) {
    assertCondition(Boolean(rule.id), `${filePath}: rule missing id`);
    assertCondition(Boolean(rule.severity), `${filePath}: rule missing severity`);
    assertCondition(Boolean(rule.description), `${filePath}: rule missing description`);
  }
}

function validateSkill(filePath: string): void {
  const text = readFileSync(filePath, 'utf8');
  const requiredSections = ['# Skill:', '## Purpose', '## Inputs', '## Rules', '## Output'];

  for (const section of requiredSections) {
    assertCondition(text.includes(section), `${filePath}: missing section ${section}`);
  }
}

function validateCodexSkill(skillDir: string): void {
  const skillFile = path.join(skillDir, 'SKILL.md');
  const text = readFileSync(skillFile, 'utf8');

  assertCondition(existsSync(skillFile), `${skillDir}: missing SKILL.md`);
  assertCondition(text.includes('# '), `${skillFile}: missing heading`);
  assertCondition(text.includes('## Workflow'), `${skillFile}: missing Workflow section`);
  assertCondition(text.includes('## Rules'), `${skillFile}: missing Rules section`);
}

function validatePipeline(filePath: string): void {
  const pipeline = readJson<Pipeline>(filePath);
  const pipelineDir = path.dirname(filePath);

  assertCondition(Boolean(pipeline.id), `${filePath}: missing id`);
  assertCondition(Boolean(pipeline.version), `${filePath}: missing version`);
  assertCondition(Boolean(pipeline.description), `${filePath}: missing description`);
  assertCondition(pipeline.rules.length > 0, `${filePath}: rules must not be empty`);
  assertCondition(pipeline.skills.length > 0, `${filePath}: skills must not be empty`);
  assertCondition(pipeline.stages.length > 0, `${filePath}: stages must not be empty`);

  for (const ruleRef of pipeline.rules) {
    const rulePath = path.resolve(pipelineDir, ruleRef);
    assertCondition(existsSync(rulePath), `${filePath}: missing rule reference ${ruleRef}`);
  }

  for (const skillRef of pipeline.skills) {
    const skillPath = path.resolve(pipelineDir, skillRef);
    assertCondition(existsSync(skillPath), `${filePath}: missing skill reference ${skillRef}`);
  }

  for (const stage of pipeline.stages) {
    assertCondition(Boolean(stage.id), `${filePath}: stage missing id`);
    assertCondition(Boolean(stage.name), `${filePath}: stage missing name`);
    assertCondition(typeof stage.required === 'boolean', `${filePath}: stage required invalid`);
    assertCondition(stage.checks.length > 0, `${filePath}: stage checks must not be empty`);
  }
}

function filesIn(dirPath: string, extension: string): string[] {
  return readdirSync(dirPath)
    .filter((fileName) => fileName.endsWith(extension))
    .map((fileName) => path.join(dirPath, fileName));
}

function main(): void {
  validateDirectories();

  const ruleFiles = filesIn(rulesDir, '.json');
  const skillFiles = filesIn(skillsDir, '.md');
  const pipelineFiles = filesIn(playbooksDir, '.json');
  const codexSkillDirs = readdirSync(codexSkillsDir)
    .map((fileName) => path.join(codexSkillsDir, fileName))
    .filter((filePath) => existsSync(path.join(filePath, 'SKILL.md')));

  assertCondition(ruleFiles.length > 0, 'No rule files found');
  assertCondition(skillFiles.length > 0, 'No skill files found');
  assertCondition(pipelineFiles.length > 0, 'No pipeline files found');
  assertCondition(codexSkillDirs.length > 0, 'No Codex skills found');

  ruleFiles.forEach(validateRuleSet);
  skillFiles.forEach(validateSkill);
  pipelineFiles.forEach(validatePipeline);
  codexSkillDirs.forEach(validateCodexSkill);

  console.log(
    `Validated ${pipelineFiles.length} pipelines, ${skillFiles.length} registry skills, ${codexSkillDirs.length} Codex skills, ${ruleFiles.length} rule sets.`
  );
}

main();
