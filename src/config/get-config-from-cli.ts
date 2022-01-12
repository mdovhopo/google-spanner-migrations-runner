import { Command } from 'commander';
import dotenv from 'dotenv';

import { MIGRATIONS_LOG_TABLE, MIGRATIONS_ROOT_DIR } from '../common/defaults';
import { SpannerMigrationsConfig } from '../types/types';

export function getConfigFromCli(): SpannerMigrationsConfig {
  dotenv.config();

  const prog = new Command()
    .version('1.0.0')
    .requiredOption(
      '-pid, --project-id <id>',
      'google project id to use instance id (defaults to env SERVICE_PROJECT_ID)',
      process.env.SERVICE_PROJECT_ID
    )
    .requiredOption(
      '-i, --instance-id <id>',
      'spanner instance id (defaults to env SPANNER_INSTANCE_ID)',
      process.env.SPANNER_INSTANCE_ID
    )
    .requiredOption(
      '-d, --database-id <id>',
      'spanner database id (defaults to env SPANNER_DATABASE_ID)',
      process.env.SPANNER_DATABASE_ID
    )
    .requiredOption(
      '-em, --is-emulator',
      'use emulator instead of actual spanner (defaults to existance of SPANNER_EMULATOR_HOST env)',
      !!process.env.SPANNER_EMULATOR_HOST
    )
    .requiredOption(
      '-mr, --migrations-root <path>',
      `directory with migrations files (defaults to env MIGRATIONS_ROOT_DIR or ${MIGRATIONS_ROOT_DIR})`,
      process.env.MIGRATIONS_ROOT_DIR || MIGRATIONS_ROOT_DIR
    )
    .requiredOption(
      '-mt, --migrations-table <name>',
      `name of migrations table that keeps track of migrations status (defaults to env MIGRATIONS_LOG_TABLE or ${MIGRATIONS_LOG_TABLE})`,
      process.env.MIGRATIONS_LOG_TABLE || MIGRATIONS_LOG_TABLE
    )
    .parse(process.argv);

  return prog.opts<SpannerMigrationsConfig>();
}
