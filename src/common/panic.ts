export function panic(err: Error | string): never {
  if (typeof err === 'string') {
    throw new Error(err);
  }
  throw err;
}
