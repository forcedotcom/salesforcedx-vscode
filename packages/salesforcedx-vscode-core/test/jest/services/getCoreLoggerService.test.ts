/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { LoggerLevel } from '@salesforce/vscode-service-provider';
import { CoreLoggerService, getCoreLoggerService } from '../../../src/services/getCoreLoggerService';

describe('getCoreLoggerService', () => {
  it('should return an instance of ILogger', () => {
    const loggerName = 'testLogger';
    const logger = getCoreLoggerService(loggerName);
    expect(logger).toBeInstanceOf(CoreLoggerService);
  });

  it('should return a logger with the correct name', () => {
    const loggerName = 'testLogger';
    const logger = getCoreLoggerService(loggerName);
    expect(logger.getName()).toBe(loggerName);
  });

  it('should return a logger with the default log level', () => {
    const loggerName = 'testLogger';
    const logger = getCoreLoggerService(loggerName);
    expect(logger.getLevel()).toBe(0);
  });

  it('should return a logger with the correct level', async () => {
    const loggerName = 'testLogger';
    const logLevel = LoggerLevel.INFO;
    const logger = getCoreLoggerService(loggerName);
    logger.setLevel(logLevel);

    expect(logger.getLevel()).toBe(logLevel);
  });

  it('should return a logger with an empty buffered records array', () => {
    const loggerName = 'testLogger';
    const logger = getCoreLoggerService(loggerName);
    expect(logger.getBufferedRecords()).toEqual([]);
  });

  it('should return a logger with an empty log contents', () => {
    const loggerName = 'testLogger';
    const logger = getCoreLoggerService(loggerName);
    expect(logger.readLogContentsAsText()).toBe('');
  });

  it('should return a child logger with the specified name', () => {
    const loggerName = 'testLogger';
    const childName = 'childLogger';
    const logger = getCoreLoggerService(loggerName);
    const childLogger = logger.child(childName);
    expect(childLogger.getName()).toBe(`${loggerName}.${childName}`);
  });
});
