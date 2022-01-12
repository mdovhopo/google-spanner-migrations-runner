import { Database, Instance, Spanner, Transaction } from '@google-cloud/spanner';

import { MIGRATIONS_LOG_TABLE, MIGRATIONS_ROOT_DIR } from './common/defaults';
import { logger } from './common/logger';
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

  constructor(protected readonly config: SpannerMigrationsConfig) {
    this.spanner = new Spanner({ projectId: config.projectId });
    this.instance = this.spanner.instance(config.instanceId);
    this.db = this.instance.database(config.databaseId);

    this.migrationsTable = config.migrationsTable || MIGRATIONS_LOG_TABLE;
    this.migrationsRoot = config.migrationsRoot || MIGRATIONS_ROOT_DIR;
  }

  protected async getOrCreateInstance(): Promise<void> {
    const id = this.config.instanceId;
    logger.log(`Checking instance ${id}...`);

    const [instExists] = await this.spanner.instance(id).exists();
    if (instExists) {
      logger.log(`instance ${id} exists`);
      return;
    }

    logger.log(`No instance ${id} found`);
    await this.spanner.createInstance(id, { nodes: 1, config: '' });

    logger.log(`Instance ${id} created`);
  }

  protected async getOrCreateDatabase(): Promise<void> {
    const id = this.config.databaseId;
    logger.log(`Checking database ${id}...`);

    const dbRef = this.instance.database(id);

    const [dbExists] = await dbRef.exists();
    if (dbExists) {
      logger.log(`Database ${id} exists`);
      return;
    }

    logger.log(`No database ${id} found`);
    await this.instance.createDatabase(id);

    logger.log(`Database ${id} created`);
  }

  protected async prepareMigrationsTable(): Promise<void> {
    logger.log('Checking migrations-engine table...');

    const exists = await this.db
      .run(`SELECT * from ${this.migrationsTable} LIMIT 1`)
      .then(() => true)
      .catch((err) => (err.details?.includes('not found') ? false : panic(err)));

    if (exists) {
      logger.log(`Migration table already exists`);
      return;
    }

    await this.db.createTable(`
      CREATE TABLE ${this.migrationsTable} (
        id          STRING(64) NOT NULL,
        success     BOOL NOT NULL,
        appliedAt   TIMESTAMP NOT NULL,
        error       STRING(4096),
      ) PRIMARY KEY (id)`);
    logger.log(`Migration table was created`);
  }

  protected async getMigrations(): Promise<Migration[]> {

    logger.log(`Reading all migrations from path ${this.migrationsRoot}`);

    const rawMigrations = await loadMigrations(this.migrationsRoot);
    const { success, errors, migrations } = parseMigrations(rawMigrations);

    if (!success) {
      logger.error(`Unable to parse some migrations.\nErrors:\n${errors?.map((err) => `\t${err}`)}`);
      panic(`See error above`);
    }

    logger.log(`Got ${migrations.length} migration(s)`);
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

  protected async applyMigration({ id, type, statements }: Migration): Promise<boolean> {
    const [applied] = await this.db.run({
      sql: `SELECT id from ${this.migrationsTable} where id = @id and success = true;`,
      params: { id },
      json: true,
    });

    if (applied.length !== 0) {
      logger.log(`Migration ${id} is already applied, skipping.`);
      return true;
    }

    try {
      logger.log(`Applying ${id} migration...`);

      if (type === 'update-schema') {
        await this.db.updateSchema({ statements });
      }
      if (type === 'data-manipulation') {
        const transaction = async (t: Transaction) => {
          for (const statement of statements) {
            await t.run(statement);
          }
          await t.commit();
        };

        await this.db.runTransactionAsync(transaction);
      }
      logger.log(`Migration ${id} applied`);
      await this.saveMigrationResult(id);
      return true;
    } catch (e) {
      const err: any = e;
      logger.error(`Migration ${id} failed.\nDetails: ${err.details}`);
      await this.saveMigrationResult(id, err.details);
      return false;
    }
  }

  async runMigrations() {
    logger.log(`Migration started on path ${process.cwd()}`);
    try {
      // check instance only on emulator
      // in real env, instance must be created & configured manually
      if (this.config.isEmulator) {
        await this.getOrCreateInstance();
      }
      await this.getOrCreateDatabase();

      await this.prepareMigrationsTable();

      const migrations = await this.getMigrations();

      for (const migration of migrations) {
        const success = await this.applyMigration(migration);
        if (!success) {
          logger.error(`Migration failed, stop..`);
          break;
        }
      }
    } catch (e) {
      const err = e as Error;
     logger.error(`Caught global error.\nDetails: ${err.message}`);
    }
    logger.log(`Migration finished`);
  }
}
