import { Database, Instance, Spanner, Transaction } from '@google-cloud/spanner';

import { MIGRATIONS_LOG_TABLE, MIGRATIONS_ROOT_DIR } from './common/defaults';
import { createLogger, Logger } from './common/logger';
import { panic } from './common/panic';
import { loadMigrations } from './loader/load-migrations';
import { parseMigrations } from './loader/parse-migrations';
import { Migration, SpannerMigrationsConfig } from './types/types';

export class SpannerMigration {
  readonly spanner: Spanner;
  readonly instance: Instance;
  readonly db: Database;
  readonly migrationsTable: string;
  readonly migrationsRoot: string;
  protected readonly logger: Logger;
  readonly isEmulator: boolean;

  constructor(protected readonly config: SpannerMigrationsConfig) {
    this.spanner = new Spanner({ projectId: config.projectId });
    this.instance = this.spanner.instance(config.instanceId);
    this.db = this.instance.database(config.databaseId);

    this.isEmulator =
      config.isEmulator === undefined ? !!process.env.SPANNER_EMULATOR_HOST : config.isEmulator;

    this.migrationsTable = config.migrationsTable || MIGRATIONS_LOG_TABLE;
    this.migrationsRoot = config.migrationsRoot || MIGRATIONS_ROOT_DIR;

    this.logger = createLogger(config.isSilent);
  }

  protected async ensureInstance(): Promise<void> {
    const id = this.config.instanceId;
    this.logger.log(`Checking instance ${id}...`);

    const [instExists] = await this.spanner.instance(id).exists();
    if (instExists) {
      this.logger.log(`instance ${id} exists`);
      return;
    }

    this.logger.log(`No instance ${id} found`);
    await this.spanner.createInstance(id, { nodes: 1, config: '' });

    this.logger.log(`Instance ${id} created`);
  }

  protected async ensureDatabase(): Promise<void> {
    const id = this.config.databaseId;
    this.logger.log(`Checking database ${id}...`);

    const dbRef = this.instance.database(id);

    const [dbExists] = await dbRef.exists();
    if (dbExists) {
      this.logger.log(`Database ${id} exists`);
      return;
    }

    this.logger.log(`No database ${id} found`);
    await this.instance.createDatabase(id);

    this.logger.log(`Database ${id} created`);
  }

  protected async prepareMigrationsTable(): Promise<void> {
    this.logger.log('Checking migrations-engine table...');

    const exists = await this.db
      .run(`SELECT * from ${this.migrationsTable} LIMIT 1`)
      .then(() => true)
      .catch((err) => (err.details?.includes('not found') ? false : panic(err)));

    if (exists) {
      this.logger.log(`Migration table already exists`);
      return;
    }

    await this.db.createTable(`
      CREATE TABLE ${this.migrationsTable} (
        id          STRING(64) NOT NULL,
        success     BOOL NOT NULL,
        appliedAt   TIMESTAMP NOT NULL,
        error       STRING(4096),
      ) PRIMARY KEY (id)`);
    this.logger.log(`Migration table was created`);
  }

  protected async getMigrations(): Promise<Migration[]> {
    this.logger.log(`Reading all migrations from path ${this.migrationsRoot}`);

    const rawMigrations = await loadMigrations(this.migrationsRoot);
    if (rawMigrations.length === 0) {
      this.logger.error(
        `Could not find any migrations, you probably selected wrong migrations root directory`
      );
      throw new Error(`See error above`);
    }

    const { success, errors, migrations } = parseMigrations(rawMigrations);

    if (!success) {
      this.logger.error(
        `Unable to parse some migrations.\nErrors:\n${errors?.map((err) => `\t${err}`)}`
      );
      throw new Error(`See error above`);
    }

    this.logger.log(`Got ${migrations.length} migration(s)`);
    return migrations;
  }

  protected async saveMigrationResult(id: string, result: string | true = true): Promise<void> {
    await this.db.table(this.migrationsTable).replace({
      id,
      success: result === true,
      appliedAt: new Date().toISOString(),
      error: typeof result === 'string' ? result : null,
    });
  }

  protected async applyMigration({ id, type, statements }: Migration): Promise<void> {
    const [applied] = await this.db.run({
      sql: `SELECT id from ${this.migrationsTable} where id = @id and success = true;`,
      params: { id },
      json: true,
    });

    if (applied.length !== 0) {
      this.logger.log(`Migration ${id} is already applied, skipping.`);
      return;
    }

    try {
      this.logger.log(`Applying ${id} migration...`);

      if (type === 'DDL') {
        const allowedStatements = this.isEmulator
          ? /* on emulator some of the statements are not supported, so we need to ignore them... */
            statements.filter(({ str, disabledInEmulator }) =>
              disabledInEmulator
                ? this.logger.warn(
                    `Migration ${id} statement [${str}]: not supported on emulator. ignored.`
                  )
                : true
            )
          : /* in cloud, run all statements */ statements;
        if (allowedStatements.length > 0) {
          allowedStatements.forEach(({ str }) => {
            this.logger.log(`Applying DDL statement [${str}]`);
          });
          await this.db.updateSchema({ statements: allowedStatements.map(({ str }) => str) });
        } else {
          this.logger.warn(`0 statements found in migration ${id}, skipping.`);
        }
      }
      if (type === 'DML') {
        await this.db.runTransactionAsync(async (t: Transaction) => {
          for (const { str } of statements) {
            this.logger.log(`Applying DML statement [${str}]`);
            await t.run(str);
          }
          await t.commit();
        });
      }
      this.logger.log(`Migration ${id} applied`);
      await this.saveMigrationResult(id);
    } catch (e) {
      const err: any = e;
      await this.saveMigrationResult(id, err.details);
      throw new Error(`Migration ${id} failed.\nDetails: ${err.details}`);
    }
  }

  async runMigrations() {
    this.logger.log(`Migration started on path ${process.cwd()}`);
    this.logger.log(`Config: ${JSON.stringify(this.config)}`);
    try {
      // check instance only on emulator
      // in real env, instance must be created & configured manually
      if (this.isEmulator) {
        await this.ensureInstance();
        await this.ensureDatabase();
      }

      await this.prepareMigrationsTable();

      const migrations = await this.getMigrations();

      for (const migration of migrations) {
        await this.applyMigration(migration);
      }
    } catch (e) {
      this.logger.error((e as Error).message);
      throw e;
    }
  }
}
