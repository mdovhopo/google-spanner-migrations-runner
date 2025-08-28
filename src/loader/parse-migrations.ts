import {
  ParseResult,
  ParseTotalResult,
  RawMigration,
  Statement,
  STATEMENT_TYPES,
  StatementType,
} from '../types/types';

// https://cloud.google.com/spanner/docs/reference/standard-sql/data-definition-language
const ddlStatementsPatterns: RegExp[] = [
  // database statements
  /^create\s+database/i,
  /^alter\s+database/i,

  // table statements
  // CREATE TABLE [ IF NOT EXISTS ] table_name
  /^create\s{1,}(?:if\s+not\s+exists\s+)?\s{0,}table/i,
  /^alter\s+table/i,
  /^drop\s+table/i,

  // index statements
  // CREATE [ UNIQUE ] [ NULL_FILTERED ] INDEX [ IF NOT EXISTS ] index_name
  /^create\s{1,}(?:unique\s+|null_filtered\s+)?\s{0,}index/i,
  /^alter\s+index/i,
  /^drop\s+index/i,

  // view statements
  /^create\s+view/i,
  /^create\s+or\s+replace\s+view/i,
  /^drop\s+view/i,

  // change stream statements
  /^create\s+change\s+stream/i,
  /^alter\s+change\s+stream/i,
  /^drop\s+change\s+stream/i,

  // role statements
  /^create\s+role/i,
  /^drop\s+role/i,

  // grant statements
  /^grant/i,
  /^revoke/i,

  // statistics statements
  /^alter\s+statistics/i,
  /^analyze/i,

  // ml models
  /^create\s+model/i,
  /^create\s+or\s+replace\s+model/i,
  /^create\s+model\s+if\s+not\s+exists/i,
  /^alter\s+(?:if\s+exists\s+)?model/i,
];

function getStatementType(stm: Statement): StatementType {
  return ddlStatementsPatterns.some((regex) => regex.test(stm.str)) ? 'DDL' : 'DML';
}

const fileRegex = /^[0-9]{5}[a-z-]{0,256}\.sql$/;
function validateFileName(name: string): void {
  if (!fileRegex.test(name)) {
    throw new Error(
      `Migration file name must follow regex: ${fileRegex.toString()}. Examples: 00001-init.sql, 00004.sql`,
    );
  }
}

function isStatementSupportedByEmulator(statement: string): boolean {
  const notSupportedPatterns: RegExp[] = [
    /^alter\s+table\s+[a-z][\d\w_]{0,128}\s+add\s+row\s+deletion\s+policy\s+.+$/i,
    /^create\s+view/i,
    /^create\s+or\s+replace\s+view/i,
    /^drop\s+view/i,
    /^create\s+role/i,
    /^drop\s+role/i,
    /^grant/i,
    /^revoke/i,
  ];

  return !notSupportedPatterns.some((regexp) => regexp.test(statement));
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
    throw new Error(`Migration file must specify at least one statement`);
  }

  return statements.map((str) => ({
    str,
    disabledInEmulator: !isStatementSupportedByEmulator(str),
  }));
}

function assertStatementsType(statements: Statement[]): void {
  const type = getStatementType(statements[0]);
  if (statements.some((stm) => getStatementType(stm) !== type)) {
    throw new Error(
      `Single migration allows only one type of statements due to spanner SDK limitations. Available types - ${STATEMENT_TYPES}`,
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
