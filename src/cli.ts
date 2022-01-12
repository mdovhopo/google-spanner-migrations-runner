import { getConfigFromCli } from './config/get-config-from-cli';
import { SpannerMigration } from './core';

async function run() {
  const config = getConfigFromCli();
  const runner = new SpannerMigration(config);

  await runner.runMigrations();
}

run();
