import { Spanner } from '@google-cloud/spanner';
import fs from 'fs';
import { describe, it } from 'node:test';

import { SpannerMigration } from '../../src';
import { assertData, assertSchema, recreateDatabase } from '../utils/spanner';

const testCasesRoot = 'test/samples/valid';

describe('happy cases', async () => {
  const cases = fs.readdirSync(testCasesRoot);
  const spanner = new Spanner({
    projectId: process.env.SERVICE_PROJECT_ID!,
  });

  for (const testCase of cases) {
    await it(`migration test: ${testCase}`, async () => {
      const db = await recreateDatabase(spanner, process.env.SPANNER_INSTANCE_ID!, testCase);

      const runner = new SpannerMigration({
        isEmulator: true,
        isSilent: true,
        projectId: process.env.SERVICE_PROJECT_ID!,
        instanceId: process.env.SPANNER_INSTANCE_ID!,
        databaseId: testCase,
        migrationsRoot: `${testCasesRoot}/${testCase}`,
      });

      await assertSchema(db, '');
      await assertData(db, {});

      await runner.runMigrations();

      const expectedSchema = fs.readFileSync(
        `${testCasesRoot}/${testCase}/expected-schema.txt`,
        'utf8'
      );

      await assertSchema(db, expectedSchema);
      const expectedData = JSON.parse(
        fs.readFileSync(`${testCasesRoot}/${testCase}/expected-data.json`, 'utf8')
      );
      await assertData(db, expectedData);
    });
  }
});
