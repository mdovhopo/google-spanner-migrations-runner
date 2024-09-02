import { m } from 'multiline-str';

import { Migration } from '../types/types';
import { loadMigrations } from './load-migrations';
import { parseMigrations } from './parse-migrations';

describe('parseMigrations', () => {
  const cases: [string, Migration[]][] = [
    [
      './test/samples/valid/multiple',
      [
        {
          id: '00001-init',
          type: 'DDL',
          statements: [
            {
              disabledInEmulator: false,
              str: m`
                    CREATE TABLE test (
                      id              INT64 NOT NULL,
                    ) PRIMARY KEY (id)
                    `,
            },
            {
              disabledInEmulator: false,
              str: m`
                    CREATE TABLE test_2 (
                      id              INT64 NOT NULL,
                      name            STRING(128),
                    ) PRIMARY KEY (id)
                    `,
            },
          ],
        },
        {
          id: '00002',
          type: 'DDL',
          statements: [
            {
              disabledInEmulator: false,
              str: 'ALTER TABLE test_2 ADD COLUMN lastName STRING(128)',
            },
          ],
        },
      ],
    ],
    [
      './test/samples/valid/no-sql-files-ignored',
      [
        {
          id: '00001-init',
          type: 'DDL',
          statements: [
            {
              disabledInEmulator: false,
              str: m`
                    CREATE TABLE test (
                      id              INT64 NOT NULL,
                    ) PRIMARY KEY (id)
                    `,
            },
            {
              disabledInEmulator: false,
              str: m`
                    CREATE TABLE test_2 (
                      id              INT64 NOT NULL,
                      name            STRING(128),
                    ) PRIMARY KEY (id)
                    `,
            },
          ],
        },
        {
          id: '00002',
          type: 'DDL',
          statements: [
            {
              disabledInEmulator: false,
              str: 'ALTER TABLE test_2 ADD COLUMN lastName STRING(128)',
            },
          ],
        },
      ],
    ],
    [
      './test/samples/valid/single',
      [
        {
          id: '00001',
          type: 'DDL',
          statements: [
            {
              disabledInEmulator: false,
              str: m`
                    CREATE TABLE test (
                      id              INT64 NOT NULL,
                      name            STRING(256),
                      last_name       STRING(256),
                    ) PRIMARY KEY (id)
                    `,
            },
            {
              disabledInEmulator: false,
              str: m`
                    CREATE TABLE test_2 (
                      id              INT64 NOT NULL,
                      name            INT64 NOT NULL,
                      last_name       STRING(256),
                      first_name      STRING(128),
                      metadata        JSON,
                    ) PRIMARY KEY (id)
                    `,
            },
          ],
        },
      ],
    ],
    [
      './test/samples/valid/with-comments',
      [
        {
          id: '00001',
          type: 'DDL',
          statements: [
            {
              disabledInEmulator: false,
              str: m`
              CREATE TABLE test (
                id              INT64 NOT NULL,
                createdAt       TIMESTAMP NOT NULL,
              ) PRIMARY KEY (id)
              `,
            },
          ],
        },
      ],
    ],
    [
      './test/samples/valid/with-ignored-statements',
      [
        {
          id: '00001',
          type: 'DDL',
          statements: [
            {
              disabledInEmulator: false,
              str: m`
                    CREATE TABLE test (
                      id              INT64 NOT NULL,
                      createdAt       TIMESTAMP NOT NULL,
                    ) PRIMARY KEY (id)
                    `,
            },
          ],
        },
        {
          id: '00002',
          type: 'DDL',
          statements: [
            {
              disabledInEmulator: true,
              str: 'alter table test\nadd row deletion policy (older_than(createdAt, interval 30 day))',
            },
          ],
        },
      ],
    ],
    [
      './test/samples/valid/valid-dml',
      [
        {
          id: '00001',
          type: 'DDL',
          statements: [
            {
              disabledInEmulator: false,
              str: m`
                    CREATE TABLE test (
                      id              INT64 NOT NULL,
                    ) PRIMARY KEY (id)
                    `,
            },
          ],
        },
        {
          id: '00002',
          type: 'DML',
          statements: [
            {
              disabledInEmulator: false,
              str: 'INSERT INTO test (id) VALUES (42)',
            },
          ],
        },
      ],
    ],
  ];

  for (const [root, expectedMigrations] of cases) {
    it(`should parse valid migrations from ${root} correctly`, () => {
      const files = loadMigrations(root);
      console.log(files);
      const { migrations, success, errors } = parseMigrations(files);

      console.log(migrations, errors);

      expect(errors).toEqual([]);
      expect(success).toBe(true);
      expect(migrations).toEqual(expectedMigrations);
    });
  }

  // it.each([['./test/samples/invalid/multiple-statements-types-per-migration', [{}]]])(
  //   'should fail to parse invalid migrations from %s correctly',
  //   (root, expectedMigrations) => {
  //     const files = loadMigrations(root);
  //     const { migrations, success, errors } = parseMigrations(files);

  //     expect(migrations).toEqual(expectedMigrations);
  //     expect(success).toBe(true);
  //     expect(errors).toEqual([]);
  //   }
  // );
});
