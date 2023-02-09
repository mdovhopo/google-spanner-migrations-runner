# Google Spanner Migrations Runner

[![Deploy](https://github.com/mdovhopo/google-spanner-migrations-runner/workflows/build/badge.svg)](https://github.com/mdovhopo/google-spanner-migrations-runner/workflows/build/badge.svg)

## What is this?

This tool will take care of automatic schema managing in your
Spanner database (both Google-managed and emulator). This is basically an
engine for running migrations. The burden of writing & testing migrations (sql scripts)
is on you. This engine does not generate schema from your code.

What it can do:

- run your migrations (from .sql files)
- keep track of migrations, to not reapply already processed.

## How it works

Algorithm:

1. Goes though `migrations` directory
2. Fetches all `*.sql` files
3. Validates them
4. Applies them in order, that they are in directory (in transaction), so naming matters

## Usage

### Requirements

To run tool, you need to have nodejs 14+ version installed

### Create your migrations

To add migrations, just add `*.sql` file with migration to `migrations` directory.

Each statement must be separated with `;`, engine will rely on this to run each query separately.

Example of valid migration:

```sql
CREATE TABLE test (
  id          INT64 NOT NULL,
) PRIMARY KEY (id);
ALTER TABLE test ADD COLUMN newcol BYTES(100);
```

_IMPORTANT_ each migration MUST include only one type of statements.
Available types:

- Create/modify tables
- Other SQL queries

Must follow pattern - `[0-9]{5}[a-z\-]{0,256}.sql`. Once migration is applied
name MUST NOT be changed, as engine relies on name to figure out if migration already applied.
Also do not modify already applied migrations (only if you absolutely sure)

Migrations will be applied in the same order as files in directory.

Examples of valid and invalid migrations can be found [here](./test/samples)

### What happens if I run migration twice?

Engine stores applied migrations in special table (managed automatically)
and just skips already applied migrations.

### Run migrations

From shell

```sh
# via npx
npx google-spanner-migrations-runner --project-id --instance-id=test --database-id=test

# or install globally
npm i -g google-spanner-migrations-runner
google-spanner-migrations-runner --project-id --instance-id=test --database-id=test
```

Also cli configuration is available by env variables (automatically loaded from env)
_Note:_ if you have `.env` file where you run this cli, it will load variables and use them.
Actual env variables you can check via:

```shell
npx google-spanner-migrations-runner --help
```

From code

```ts
import { SpannerMigration } from 'google-spanner-migrations-runner';

async function run() {
  const config = {
    /* your config */
  };
  const runner = new SpannerMigration(config);

  await runner.runMigrations();
}

run();
```

## Emulator limitations

Some features are not available on emulator, so runner will ignore &
log ignored statements on emulator.

Features ignored:

- adding row deletion policy
- creating, replacing or dropping views
- creating and dropping roles
- granting or revoking permissions to existing roles

## Contributing

If you want to contribute to this repo, or just run it locally,
you can use Spanner emulator:

```shell
docker compose up -d
```

and run tool with ts-node using samples:

```shell
ts-node src/cli.ts -mr test/samples/valid/single
```

## Licence

Bootstrapped with: [create-ts-lib-gh](https://github.com/glebbash/create-ts-lib-gh)

This project is [Mit Licensed](LICENSE).
