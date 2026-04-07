export const STATEMENT_TYPES = ['DDL', 'DML'] as const;
export type StatementType = typeof STATEMENT_TYPES[number];

export type Statement = { disabledInEmulator?: boolean; str: string };

export type RawMigration = {
  file: string;
  raw: string;
};

/** Parsed from full-line `-- @name value` migration header comments. */
export type MigrationAnnotation = {
  name: string;

  value: string;
};

export type Migration = {
  id: string;

  type: StatementType;

  statements: Statement[];

  /** Present only when the file declares header annotations; omit for backward compatibility. */
  annotations?: MigrationAnnotation[];
};

export type ParseTotalResult = {
  success: boolean;

  migrations: Migration[];

  errors?: string[];
};

export type ParseResult = {
  success: boolean;

  migration: Migration;

  error?: string;
};

export type SpannerMigrationsConfig = {
  instanceId: string;

  databaseId: string;

  migrationsRoot?: string;

  migrationsTable?: string;

  isEmulator?: boolean;

  projectId?: string;

  /** Logical environment (e.g. staging, prod); used by `@only-in-env` migration annotations. */
  env?: string;

  isSilent?: true;
};
