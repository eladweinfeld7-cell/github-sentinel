import * as fs from 'fs';
import * as path from 'path';

const name = process.argv[2];
if (!name) {
  console.error('Usage: npx ts-node scripts/generate-app.ts <app-name>');
  process.exit(1);
}

const appDir = path.join(__dirname, '..', 'apps', name, 'src');

if (fs.existsSync(appDir)) {
  console.error(`App already exists: apps/${name}`);
  process.exit(1);
}

fs.mkdirSync(appDir, { recursive: true });
fs.mkdirSync(path.join(__dirname, '..', 'apps', name, 'test'), {
  recursive: true,
});

const mainContent = `import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  Logger.log(\`${name} listening on :\${port}\`, 'Bootstrap');
}

void bootstrap();
`;

const moduleContent = `import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
  ],
})
export class AppModule {}
`;

const tsconfigContent = `{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "declaration": false,
    "outDir": "../../dist/apps/${name}"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "test", "**/*spec.ts"]
}
`;

fs.writeFileSync(path.join(appDir, 'main.ts'), mainContent);
fs.writeFileSync(path.join(appDir, 'app.module.ts'), moduleContent);
fs.writeFileSync(
  path.join(__dirname, '..', 'apps', name, 'tsconfig.app.json'),
  tsconfigContent,
);

console.log(`Created: apps/${name}/src/main.ts`);
console.log(`Created: apps/${name}/src/app.module.ts`);
console.log(`Created: apps/${name}/tsconfig.app.json`);
console.log(`\nNext steps:`);
console.log(`  1. Add "${name}" project entry to nest-cli.json`);
console.log(`  2. Add build/start scripts to package.json`);
