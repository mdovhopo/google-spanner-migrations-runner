import assert from 'node:assert';
import { describe, it } from 'node:test';

import { evaluateMigrationAnnotations } from '../../src/annotations/evaluate-migration-annotations';

describe('evaluateMigrationAnnotations', () => {
  it('runs when there is no @only-in-env', () => {
    assert.deepStrictEqual(evaluateMigrationAnnotations(undefined, undefined), { run: true });
    assert.deepStrictEqual(evaluateMigrationAnnotations([], 'staging'), { run: true });
  });

  it('runs when env matches', () => {
    assert.deepStrictEqual(
      evaluateMigrationAnnotations([{ name: 'only-in-env', value: 'prod' }], 'prod'),
      { run: true },
    );
  });

  it('skips when env mismatches', () => {
    const d = evaluateMigrationAnnotations([{ name: 'only-in-env', value: 'prod' }], 'staging');
    assert.strictEqual(d.run, false);
    if (!d.run) {
      assert.ok(d.skipMessage.includes('prod'));
      assert.ok(d.skipMessage.includes('staging'));
    }
  });

  it('skips when env is omitted', () => {
    const d = evaluateMigrationAnnotations([{ name: 'only-in-env', value: 'prod' }], undefined);
    assert.strictEqual(d.run, false);
    if (!d.run) {
      assert.ok(d.skipMessage.includes('no --env passed'));
    }
  });
});
