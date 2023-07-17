import fs from 'fs';
import path from 'path';

import { RawMigration } from '../types/types';

function loadMigration(root: string, file: string): RawMigration {
  return {
    file,
    raw: fs.readFileSync(path.join(root, file), 'utf8'),
  };
}

export function loadMigrations(root: string): RawMigration[] {
  const files = fs.readdirSync(root);
  const onlySql = files.filter((file) => file.endsWith('.sql'));

  return onlySql.map((file) => loadMigration(root, file));
}
