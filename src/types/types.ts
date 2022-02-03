export const STATEMENT_TYPES = ['DDL', 'DML'] as const;
export type StatementType = typeof STATEMENT_TYPES[number];

export type Statement = { disabledInEmulator?: boolean; str: string };

export type RawMigration = {
  file: string;
  raw: string;
};

export type Migration = {
  id: string;

  type: StatementType;

  statements: Statement[];
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

  isSilent?: true;
};
