import * as fs from 'fs';
import * as path from 'path';

const name = process.argv[2];
if (!name) {
  console.error('Usage: npx ts-node scripts/generate-lib.ts <lib-name>');
  process.exit(1);
}

const pascalCase = name
  .split('-')
  .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
  .join('');

const libDir = path.join(__dirname, '..', 'libs', name, 'src');

if (fs.existsSync(libDir)) {
  console.error(`Library already exists: libs/${name}`);
  process.exit(1);
}

fs.mkdirSync(libDir, { recursive: true });

const moduleContent = `import { Module } from '@nestjs/common';

@Module({
  providers: [],
  exports: [],
})
export class ${pascalCase}Module {}
`;

const indexContent = `export { ${pascalCase}Module } from './${name}.module';
`;

const tsconfigContent = `{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "declaration": true,
    "outDir": "../../dist/libs/${name}"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "test", "**/*spec.ts"]
}
`;

fs.writeFileSync(path.join(libDir, `${name}.module.ts`), moduleContent);
fs.writeFileSync(path.join(libDir, 'index.ts'), indexContent);
fs.writeFileSync(path.join(__dirname, '..', 'libs', name, 'tsconfig.lib.json'), tsconfigContent);

console.log(`Created: libs/${name}/src/${name}.module.ts`);
console.log(`Created: libs/${name}/src/index.ts`);
console.log(`Created: libs/${name}/tsconfig.lib.json`);
console.log(`\nNext steps:`);
console.log(`  1. Add "@github-sentinel/${name}" path to tsconfig.json`);
console.log(`  2. Add "${name}" project entry to nest-cli.json`);
console.log(`  3. Add moduleNameMapper entry to package.json jest config`);
