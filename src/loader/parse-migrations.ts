import { panic } from '../common/panic';
import {
  ParseResult,
  ParseTotalResult,
  RawMigration,
  Statement,
  STATEMENT_TYPES,
  StatementType,
} from '../types/types';

function getStatementType(stm: Statement): StatementType {
  if (
    /^(CREATE TABLE|ALTER TABLE|DROP TABLE|CREATE INDEX|ALTER INDEX|DROP INDEX|CREATE VIEW|CREATE OR REPLACE VIEW|DROP VIEW|CREATE ROLE|DROP ROLE|GRANT|REVOKE)/i.test(
      stm.str
    )
  ) {
    return 'DDL';
  }

  return 'DML';
}

const fileRegex = /^[0-9]{5}[a-z\-]{0,256}\.sql$/;
function validateFileName(name: string): void {
  if (!fileRegex.test(name)) {
    panic(
      `Migration file name must follow regex: ${fileRegex.toString()}. Examples: 00001-init.sql, 00004.sql`
    );
  }
}

function isStatementSupportedByEmulator(statement: string): boolean {
  const notSupportedPatterns: ((statement: string) => boolean)[] = [
    (statement) =>
      /^(alter table [a-z][\d\w_]{0,128} add row deletion policy .+$|create view|create or replace view|drop view)/i.test(
        statement
      ),
  ];

  return !notSupportedPatterns.some((fn) => fn(statement));
}

function migrationToStatements(raw: string): Statement[] {
  const statements = raw
    // clear comments first
    .trim()
    .split('\n')
    .filter((row) => !row.trim().startsWith('--'))
    .join('\n')
    // store each SQL statement as separate string
    .split(';')
    .map((str) => str.trim())
    .filter((str) => !!str);

  if (statements.length < 1) {
    panic(`Migration file must specify at least one statement`);
  }

  return statements.map((str) => ({
    str,
    disabledInEmulator: !isStatementSupportedByEmulator(str),
  }));
}

function assertStatementsType(statements: Statement[]): void {
  const type = getStatementType(statements[0]);
  if (statements.some((stm) => getStatementType(stm) !== type)) {
    panic(
      `Single migration allows only one type of statements due to spanner SDK limitations. Available types - ${STATEMENT_TYPES}`
    );
  }
}

function parseMigration({ file, raw }: RawMigration): ParseResult {
  const migrationId = file.replace(/\.sql$/, '');

  try {
    validateFileName(file);

    const statements = migrationToStatements(raw);

    assertStatementsType(statements);

    return {
      migration: {
        id: migrationId,
        type: getStatementType(statements[0]), // type will be the same for all statements
        statements: statements,
      },
      success: true,
    };
  } catch (e) {
    const err = e as Error;
    return {
      migration: { id: migrationId, type: 'DML', statements: [] },
      success: false,
      error: `${file}: ${err.stack}`,
    };
  }
}

export function parseMigrations(raw: RawMigration[]): ParseTotalResult {
  const parsed = raw.map((raw) => parseMigration(raw));

  return {
    success: parsed.every(({ success }) => success),
    migrations: parsed.map(({ migration }) => migration),
    errors: parsed.filter(({ error }) => !!error).map(({ error }) => error as string),
  };
}
