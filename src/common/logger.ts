import colors from 'colors';

function createLogger() {
  return {
    error(message: string) {
      console.error(colors.red(`${new Date().toISOString()} [ERROR]: ${message}`));
    },

    log(message: string) {
      console.error(colors.green(`${new Date().toISOString()} [LOG]: ${message}`));
    },
  };
}

export const logger = createLogger();
