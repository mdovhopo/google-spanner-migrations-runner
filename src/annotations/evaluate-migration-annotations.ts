import { Migration } from '../types/types';

export type AnnotationRunDecision = { run: true } | { run: false; skipMessage: string };

/**
 * If `@only-in-env` is present, the migration runs only when `configEnv` is defined and equals the annotation value.
 */
export function evaluateMigrationAnnotations(
  annotations: Migration['annotations'],
  configEnv: string | undefined,
): AnnotationRunDecision {
  const list = annotations ?? [];
  const onlyInEnv = list.find((a) => a.name === 'only-in-env');
  if (!onlyInEnv) {
    return { run: true };
  }
  if (configEnv === undefined || configEnv === '') {
    return {
      run: false,
      skipMessage: `skipped: @only-in-env ${onlyInEnv.value} (no --env passed)`,
    };
  }
  if (configEnv !== onlyInEnv.value) {
    return {
      run: false,
      skipMessage: `skipped: @only-in-env ${onlyInEnv.value} (current env is ${configEnv})`,
    };
  }
  return { run: true };
}
