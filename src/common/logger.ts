import chalk from 'chalk';

function createLogger() {
  return {
    error(message: string) {
      console.error(chalk.red(`${new Date().toISOString()} [ERROR]: ${message}`));
    },

    log(message: string) {
      console.error(chalk.green(`${new Date().toISOString()} [LOG]: ${message}`));
    },
  };
}

export const logger = createLogger();
