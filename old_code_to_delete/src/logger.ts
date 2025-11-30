import pino from "pino";

let logger: pino.Logger | undefined;

export function getLogger() {
    if (!logger) {
        const pretty = process.stdout.isTTY;
        logger = pino(
            pretty
                ? {
                      transport: {
                          target: "pino-pretty",
                          options: {
                              colorize: true,
                              translateTime: "HH:MM:ss",
                          },
                      },
                  }
                : {}
        );
    }
    return logger;
}

export type Logger = pino.Logger;
