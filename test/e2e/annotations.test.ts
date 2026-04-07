import { describe, it } from 'node:test';

import { Spanner } from '@google-cloud/spanner';
import fs from 'fs';

import { SpannerMigration } from '../../src';
import { assertData, assertSchema, recreateDatabase } from '../utils/spanner';

describe('migration annotations', () => {
  const spanner = new Spanner({
    projectId: process.env.SERVICE_PROJECT_ID!,
  });
  const samplesRoot = 'test/samples/annotations';

  it('only-in-env: applies when config.env matches', async () => {
    const caseName = 'only-in-env-match';
    const db = await recreateDatabase(spanner, process.env.SPANNER_INSTANCE_ID!, caseName);

    const runner = new SpannerMigration({
      isEmulator: true,
      isSilent: true,
      projectId: process.env.SERVICE_PROJECT_ID!,
      instanceId: process.env.SPANNER_INSTANCE_ID!,
      databaseId: caseName,
      migrationsRoot: `${samplesRoot}/${caseName}`,
      env: 'test-env',
    });

    await assertSchema(db, '');
    await assertData(db, {});

    await runner.runMigrations();

    const expectedSchema = fs.readFileSync(
      `${samplesRoot}/${caseName}/expected-schema.txt`,
      'utf8',
    );
    await assertSchema(db, expectedSchema);
    const expectedData = JSON.parse(
      fs.readFileSync(`${samplesRoot}/${caseName}/expected-data.json`, 'utf8'),
    );
    await assertData(db, expectedData);
  });

  it('only-in-env: skips and records when config.env mismatches', async () => {
    const caseName = 'only-in-env-mismatch';
    const db = await recreateDatabase(
      spanner,
      process.env.SPANNER_INSTANCE_ID!,
      `${caseName}-mismatch`,
    );

    const runner = new SpannerMigration({
      isEmulator: true,
      isSilent: true,
      projectId: process.env.SERVICE_PROJECT_ID!,
      instanceId: process.env.SPANNER_INSTANCE_ID!,
      databaseId: `${caseName}-mismatch`,
      migrationsRoot: `${samplesRoot}/${caseName}`,
      env: 'wrong-env',
    });

    await assertSchema(db, '');
    await assertData(db, {});

    await runner.runMigrations();

    const expectedSchema = fs.readFileSync(
      `${samplesRoot}/${caseName}/expected-schema.txt`,
      'utf8',
    );
    await assertSchema(db, expectedSchema);
    const expectedData = JSON.parse(
      fs.readFileSync(`${samplesRoot}/${caseName}/expected-data.json`, 'utf8'),
    );
    await assertData(db, expectedData);
  });

  it('only-in-env: skips when env is not passed', async () => {
    const caseName = 'only-in-env-mismatch';
    const db = await recreateDatabase(
      spanner,
      process.env.SPANNER_INSTANCE_ID!,
      `${caseName}-no-env`,
    );

    const runner = new SpannerMigration({
      isEmulator: true,
      isSilent: true,
      projectId: process.env.SERVICE_PROJECT_ID!,
      instanceId: process.env.SPANNER_INSTANCE_ID!,
      databaseId: `${caseName}-no-env`,
      migrationsRoot: `${samplesRoot}/${caseName}`,
    });

    await assertSchema(db, '');
    await assertData(db, {});

    await runner.runMigrations();

    const expectedSchema = fs.readFileSync(
      `${samplesRoot}/${caseName}/expected-schema.txt`,
      'utf8',
    );
    await assertSchema(db, expectedSchema);
    await assertData(db, {
      migrations_log: [
        {
          id: '00001',
          success: false,
          error: 'skipped: @only-in-env test-env (no --env passed)',
        },
      ],
    });
  });
});
