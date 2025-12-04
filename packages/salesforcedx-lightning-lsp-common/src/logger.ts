/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Connection, MessageType } from 'vscode-languageserver';
import { LogMessageNotification } from 'vscode-languageserver-protocol';

/**
 * Formats console arguments into a single message string.
 */
const formatMessage = (...args: unknown[]): string =>
  args
    .map(arg => {
      if (typeof arg === 'string') {
        return arg;
      }
      if (arg instanceof Error) {
        return `${arg.message}${arg.stack ? `\n${arg.stack}` : ''}`;
      }
      try {
        return JSON.stringify(arg, null, 2);
      } catch {
        return String(arg);
      }
    })
    .join(' ');

/**
 * Static singleton logger for language servers.
 * Provides a centralized logging solution that sends messages to the LSP client
 * via the window/logMessage notification.
 *
 * Usage:
 * ```typescript
 * Logger.initialize(connection);
 * Logger.log('Log message');
 * Logger.info('Info message');
 * Logger.warn('Warning message');
 * Logger.error('Error message');
 * Logger.debug('Debug message');
 * ```
 */
export class Logger {
  private static connection: Connection | null = null;

  /**
   * Initialize the logger with an LSP connection.
   * Must be called before using any logging methods.
   *
   * @param connection - The LSP connection to send log messages to
   */
  public static initialize(connection: Connection): void {
    Logger.connection = connection;
  }

  /**
   * Internal method that handles the actual logging logic.
   */
  private static logIt(args: unknown[], level: MessageType): void {
    if (!Logger.connection) {
      // Fallback to console if logger not initialized
      const consoleMethod =
        level === MessageType.Error
          ? 'error'
          : level === MessageType.Warning
            ? 'warn'
            : level === MessageType.Info
              ? 'info'
              : level === MessageType.Debug
                ? 'debug'
                : 'log';

      console[consoleMethod](...args);
      return;
    }

    const formattedMessage = formatMessage(...args);
    void Logger.connection.sendNotification(LogMessageNotification.type, {
      type: level,
      message: formattedMessage
    });
  }

  /**
   * Log a message. Supports multiple arguments like console.log().
   *
   * @param args - The message(s) to log
   */
  public static log(...args: unknown[]): void {
    Logger.logIt(args, MessageType.Log);
  }

  /**
   * Log an info message. Supports multiple arguments like console.info().
   *
   * @param args - The message(s) to log
   */
  public static info(...args: unknown[]): void {
    Logger.logIt(args, MessageType.Info);
  }

  /**
   * Log a warning message. Supports multiple arguments like console.warn().
   *
   * @param args - The message(s) to log
   */
  public static warn(...args: unknown[]): void {
    Logger.logIt(args, MessageType.Warning);
  }

  /**
   * Log an error message. Supports multiple arguments like console.error().
   *
   * @param args - The message(s) to log
   */
  public static error(...args: unknown[]): void {
    Logger.logIt(args, MessageType.Error);
  }

  /**
   * Log a debug message. Supports multiple arguments like console.debug().
   *
   * @param args - The message(s) to log
   */
  public static debug(...args: unknown[]): void {
    Logger.logIt(args, MessageType.Debug);
  }
}
