import {
  MigrationAnnotation,
  ParseResult,
  ParseTotalResult,
  RawMigration,
  Statement,
  STATEMENT_TYPES,
  StatementType,
} from '../types/types';

/** Annotation names the parser accepts; unknown `@name` values are parse errors. */
const ALLOWED_ANNOTATION_NAMES = new Set(['only-in-env']);

/** Full-line `-- @name value` in the migration header (trimmed line). */
const ANNOTATION_LINE = /^--\s+@([a-zA-Z][a-zA-Z0-9_-]*)\s+(.+)$/;

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
  /^create\s{1,}(?:unique\s+)?(?:null_filtered\s+)?\s{0,}index/i,
  /^alter\s+index/i,
  /^drop\s+index/i,

  // CREATE SEARCH INDEX [ IF NOT EXISTS ] index_name
  /^create\s+search\s+index/i,
  // ALTER SEARCH INDEX index_name ...
  /^alter\s+search\s+index/i,
  // DROP SEARCH INDEX [ IF EXISTS ] index_name
  /^drop\s+search\s+index/i,
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

/**
 * Leading blank lines and full-line `--` comments before the first non-comment line are the header;
 * the rest is SQL body (same `--` stripping rules as before apply only to the body).
 */
function splitMigrationHeader(raw: string): { headerLines: string[]; sqlBody: string } {
  const lines = raw.split('\n');
  let i = 0;
  for (; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t === '') continue;
    if (t.startsWith('--')) continue;
    break;
  }
  return {
    headerLines: lines.slice(0, i),
    sqlBody: lines.slice(i).join('\n'),
  };
}

function parseHeaderAnnotations(headerLines: string[]): MigrationAnnotation[] {
  const annotations: MigrationAnnotation[] = [];
  const seen = new Set<string>();

  for (const line of headerLines) {
    const trimmed = line.trim();
    if (trimmed === '' || !trimmed.startsWith('--')) continue;

    if (/^--\s+@/.test(trimmed) && !ANNOTATION_LINE.test(trimmed)) {
      throw new Error(
        `malformed migration annotation (expected: -- @name value): ${trimmed}`,
      );
    }

    const m = trimmed.match(ANNOTATION_LINE);
    if (!m) continue;

    const name = m[1];
    const value = m[2].trim();
    if (!ALLOWED_ANNOTATION_NAMES.has(name)) {
      throw new Error(`unsupported migration annotation @${name}`);
    }
    if (seen.has(name)) {
      throw new Error(`duplicate migration annotation @${name}`);
    }
    seen.add(name);
    annotations.push({ name, value });
  }

  return annotations;
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

    const { headerLines, sqlBody } = splitMigrationHeader(raw);
    const annotations = parseHeaderAnnotations(headerLines);
    const statements = migrationToStatements(sqlBody);

    assertStatementsType(statements);

    const migration: ParseResult['migration'] = {
      id: migrationId,
      type: getStatementType(statements[0]), // type will be the same for all statements
      statements: statements,
    };
    if (annotations.length > 0) {
      migration.annotations = annotations;
    }

    return {
      migration,
      success: true,
    };
  } catch (e) {
    const err = e as Error;
    return {
      migration: { id: migrationId, type: 'DML', statements: [] },
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
