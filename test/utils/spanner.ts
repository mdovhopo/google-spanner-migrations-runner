import { Database, Spanner } from '@google-cloud/spanner';
import { Json } from '@google-cloud/spanner/build/src/codec';
import assert from 'node:assert';

export async function recreateDatabase(spanner: Spanner, instanceId: string, databaseId: string) {
  const instance = spanner.instance(instanceId);
  if ((await instance.exists())[0]) {
    await instance.delete();
  }
  await spanner.createInstance(instanceId, {
    config: 'whatever',
  });

  await instance.createDatabase(databaseId);

  return instance.database(databaseId);
}

export async function assertSchema(db: Database, expectedSchema: string) {
  const [schema] = await db.getSchema();

  assert.deepEqual(schema.join('\n'), expectedSchema);
}

export async function assertData(db: Database, expectedData: Record<string, any[]>) {
  const toIgnore = [
    'CHANGE_STREAM_OPTIONS',
    'KEY_COLUMN_USAGE',
    'CHANGE_STREAMS',
    'COLUMNS',
    'INDEX_COLUMNS',
    'SCHEMATA',
    'CONSTRAINT_COLUMN_USAGE',
    'VIEWS',
    'CONSTRAINT_TABLE_USAGE',
    'SPANNER_STATISTICS',
    'SUPPORTED_OPTIMIZER_VERSIONS',
    'TABLES',
    'INDEXES',
    'COLUMN_OPTIONS',
    'COLUMN_COLUMN_USAGE',
    'CHANGE_STREAM_TABLES',
    'CHANGE_STREAM_COLUMNS',
    'CHECK_CONSTRAINTS',
    'REFERENTIAL_CONSTRAINTS',
    'TABLE_CONSTRAINTS',
    'DATABASE_OPTIONS',
  ];

  const [rows] = await db.run({
    sql: `SELECT t.table_name FROM information_schema.tables as t`,
    json: true,
  });

  const actualData: Record<string, any[]> = {};
  await Promise.all(
    rows
      .filter(({ table_name }: Json) => !toIgnore.includes(table_name))
      .map(async ({ table_name }: Json) => {
        const select = table_name === 'migrations_log' ? 'id, success, error' : '*';

        const [rows] = await db.run({
          sql: `SELECT ${select} FROM ${table_name}`,
          json: true,
        });

        actualData[table_name] = rows;
      })
  );

  assert.deepEqual(actualData, expectedData);
}
