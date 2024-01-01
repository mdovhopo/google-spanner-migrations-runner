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
  const [rows] = await db.run({
    sql: `SELECT t.table_name FROM information_schema.tables as t`,
    json: true,
  });

  const isAllCapital = (str: string) => str === str.toUpperCase();

  const actualData: Record<string, any[]> = {};
  await Promise.all(
    rows
      // internal spanner tables are always upper case, so ignoring them
      // this is not 100% reliable, but good enough for the sake of testing
      .filter(({ table_name }: Json) => !isAllCapital(table_name))
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
