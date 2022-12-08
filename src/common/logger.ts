import chalk from 'chalk';

export type LogLevel = 'log' | 'error' | 'warn';
export type LogColor = 'red' | 'green' | 'yellow';

export type Logger = {
  [key in LogLevel]: (message: string) => void;
};

export function createLogger(silent = false): Logger {
  function getColorFromLevel(level: LogLevel): LogColor {
    return ({ log: 'green', error: 'red', warn: 'yellow' } as Record<LogLevel, LogColor>)[level];
  }

  function write(level: LogLevel, message: string) {
    if (silent) {
      return;
    }

    const msg = `${new Date().toISOString()} [${level.toUpperCase()}]: ${message}`;
    console[level](chalk[getColorFromLevel(level)](msg));
  }

  return {
    error(message) {
      write('error', message);
    },

    warn(message) {
      write('log', message);
    },

    log(message) {
      write('log', message);
    },
  };
}
