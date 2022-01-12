import fs from 'fs/promises';
import path from 'path';

import { RawMigration } from '../types/types';

async function loadMigration(root: string, file: string): Promise<RawMigration> {
  return {
    file,
    raw: await fs.readFile(path.join(root, file), 'utf8'),
  };
}

export async function loadMigrations(root: string): Promise<RawMigration[]> {
  const files = await fs.readdir(root);
  const onlySql = files.filter((file) => file.endsWith('.sql'));

  return await Promise.all(onlySql.map((file) => loadMigration(root, file)));
}
