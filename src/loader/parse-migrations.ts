import { panic } from '../common/panic';
import {
  ParseResult,
  ParseTotalResult,
  RawMigration,
  STATEMENT_TYPES,
  StatementType,
} from '../types/types';

function getStatementType(stm: string): StatementType {
  if (/^(CREATE TABLE|ALTER TABLE|CREATE INDEX)/i.test(stm)) {
    return 'update-schema';
  }

  return 'data-manipulation';
}

const fileRegex = /^[0-9]{5}[a-z\-]{0,256}\.sql$/;
function validateFileName(name: string): void {
  if (!fileRegex.test(name)) {
    panic(
      `Migration file name must follow regex: ${fileRegex.toString()}. Examples: 00001-init.sql, 00004.sql`
    );
  }
}

function migrationToStatements(raw: string): string[] {
  const statements = raw
    .trim()
    // store each SQL statement as separate string
    .split(';')
    .map((str) => str.trim())
    .filter((str) => !!str);

  if (statements.length < 0) {
    panic(`Migration file must specify at least one statement`);
  }

  return statements;
}

function assertStatementsType(statements: string[]): void {
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
      migration: { id: migrationId, type: 'data-manipulation', statements: [] },
      success: false,
      error: `${file}: ${err.message}`,
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
