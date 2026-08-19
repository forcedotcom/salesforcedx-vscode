/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export type ServerOptions = {
  port: number;
  targetOrg: string;
};

const readFlagValue = (args: string[], index: number, flag: string): string => {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${flag} requires a value.`);
  }
  return value;
};

const parsePort = (value: string): number => {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`Invalid port: ${value}`);
  }
  return port;
};

export const parseServerOptions = (args: string[]): ServerOptions => {
  let targetOrg: string | undefined;
  let port = 4173;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--port') {
      port = parsePort(readFlagValue(args, index, argument));
      index += 1;
    } else if (argument.startsWith('--port=')) {
      port = parsePort(argument.slice('--port='.length));
    } else if (argument === '--target-org') {
      targetOrg = readFlagValue(args, index, argument);
      index += 1;
    } else if (argument.startsWith('--target-org=')) {
      targetOrg = argument.slice('--target-org='.length);
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  if (!targetOrg) {
    throw new Error('--target-org <alias-or-username> is required.');
  }
  return { port, targetOrg };
};
