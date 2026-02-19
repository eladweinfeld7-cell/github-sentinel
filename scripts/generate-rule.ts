import * as fs from 'fs';
import * as path from 'path';

const name = process.argv[2];
if (!name) {
  console.error('Usage: npx ts-node scripts/generate-rule.ts <rule-name>');
  process.exit(1);
}

const pascalCase = name
  .split('-')
  .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
  .join('');

const rulesDir = path.join(__dirname, '..', 'rules');

const ruleContent = `import { Injectable } from '@nestjs/common';
import { Rule } from '@github-sentinel/detection-engine';
import { DetectionRule, AlertData, RuleName, Severity } from '@github-sentinel/detection-engine';
import { WebhookEvent, WebhookEventType } from '@github-sentinel/github-types';

@Rule({
  name: '${name}' as RuleName,
  description: 'TODO: describe this rule',
})
@Injectable()
export class ${pascalCase}Rule implements DetectionRule {
  readonly eventTypes = [WebhookEventType.PUSH] as const;

  async evaluate(event: WebhookEvent): Promise<AlertData | null> {
    // TODO: implement detection logic
    return null;
  }
}
`;

const specContent = `import { Test, TestingModule } from '@nestjs/testing';
import { ${pascalCase}Rule } from './${name}.rule';

describe('${pascalCase}Rule', () => {
  let rule: ${pascalCase}Rule;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [${pascalCase}Rule],
    }).compile();

    rule = module.get(${pascalCase}Rule);
  });

  it('should be defined', () => {
    expect(rule).toBeDefined();
  });

  it('should return null by default', async () => {
    // TODO: implement test
  });
});
`;

const rulePath = path.join(rulesDir, `${name}.rule.ts`);
const specPath = path.join(rulesDir, `${name}.rule.spec.ts`);

if (fs.existsSync(rulePath)) {
  console.error(`Rule already exists: ${rulePath}`);
  process.exit(1);
}

fs.writeFileSync(rulePath, ruleContent);
fs.writeFileSync(specPath, specContent);

console.log(`Created: rules/${name}.rule.ts`);
console.log(`Created: rules/${name}.rule.spec.ts`);
console.log(`\nNext steps:`);
console.log(
  `  1. Add ${pascalCase}Rule to RuleName enum in libs/detection-engine/src/enums.ts`,
);
console.log(
  `  2. Register ${pascalCase}Rule as a provider in apps/event-worker/src/app.module.ts`,
);
console.log(`  3. Implement detection logic and tests`);
