import assert from 'node:assert';
import { describe, it } from 'node:test';

import { parseMigrations } from '../../src/loader/parse-migrations';

describe('parseMigrations header annotations', () => {
  it('parses @only-in-env and leaves SQL body unchanged', () => {
    const { migrations, success, errors } = parseMigrations([
      {
        file: '00001.sql',
        raw: `-- @only-in-env prod\n\nCREATE TABLE t ( id INT64 NOT NULL ) PRIMARY KEY (id);`,
      },
    ]);
    assert.strictEqual(success, true);
    assert.deepStrictEqual(errors, []);
    assert.deepStrictEqual(migrations[0].annotations, [{ name: 'only-in-env', value: 'prod' }]);
    assert.strictEqual(migrations[0].statements.length, 1);
    assert.match(migrations[0].statements[0].str, /CREATE TABLE t/);
  });

  it('rejects unsupported annotation names', () => {
    const { success, errors } = parseMigrations([
      {
        file: '00001.sql',
        raw: `-- @unknown x\nCREATE TABLE t ( id INT64 NOT NULL ) PRIMARY KEY (id);`,
      },
    ]);
    assert.strictEqual(success, false);
    assert.ok(errors?.[0]?.includes('unsupported migration annotation @unknown'));
  });

  it('rejects malformed annotation lines', () => {
    const { success, errors } = parseMigrations([
      {
        file: '00001.sql',
        raw: `-- @only-in-env\nCREATE TABLE t ( id INT64 NOT NULL ) PRIMARY KEY (id);`,
      },
    ]);
    assert.strictEqual(success, false);
    assert.ok(errors?.[0]?.includes('malformed migration annotation'));
  });

  it('rejects duplicate @only-in-env', () => {
    const { success, errors } = parseMigrations([
      {
        file: '00001.sql',
        raw: `-- @only-in-env a\n-- @only-in-env b\nCREATE TABLE t ( id INT64 NOT NULL ) PRIMARY KEY (id);`,
      },
    ]);
    assert.strictEqual(success, false);
    assert.ok(errors?.[0]?.includes('duplicate migration annotation'));
  });
});
