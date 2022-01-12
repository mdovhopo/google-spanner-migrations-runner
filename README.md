# Google Spanner Migrations Runner

[![Deploy](https://github.com/git@github.com:mdovhopo/google-spanner-migrations-runner.git/workflows/build/badge.svg)](https://github.com/git@github.com:mdovhopo/google-spanner-migrations-runner.git/actions)
[![Coverage Status](https://coveralls.io/repos/github/git@github.com:mdovhopo/google-spanner-migrations-runner.git/badge.svg?branch=master)](https://coveralls.io/github/git@github.com:mdovhopo/google-spanner-migrations-runner.git?branch=master)

## What it is?

Toll will take care of automatic schema managing in your
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

*IMPORTANT* each migration MUST include only one type of statements.
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
cli --project-id --instance-id=test --database-id=test 
```
Also cli configuration is available by env variables (automatically loaded from env)

From code
```ts
import { SpannerMigration } from './core';

async function run() {
  const config = { /* your config */ };
  const runner = new SpannerMigration(config);

  await runner.runMigrations();
}

run();
```

This project is [Mit Licensed](LICENSE).
