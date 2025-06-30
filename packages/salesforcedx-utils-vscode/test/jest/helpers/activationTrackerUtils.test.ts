/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { EOL } from 'node:os';
import { sep } from 'node:path';
import { ExtensionContext, Uri, workspace } from 'vscode';
import {
  getExtensionHostLogActivationRecords,
  getExtensionHostLogLocation,
  readExtensionHostLog
} from '../../../src/helpers/activationTrackerUtils';

jest.mock('vscode', () => ({
  Uri: {
    file: jest.fn(path => ({ fsPath: path }))
  },
  workspace: {
    fs: {
      readFile: jest.fn()
    }
  },
  Disposable: class {
    // eslint-disable-next-line @typescript-eslint/no-useless-constructor
    constructor() {}
    dispose() {}
  },
  extensions: {
    getExtension: jest.fn()
  }
}));

const vscodeMocked = jest.mocked(workspace);

const fixPath = (fsPath: string): string => fsPath.split('/').join(sep);

describe('readExtensionHostLog', () => {
  it('should return log lines', async () => {
    vscodeMocked.fs.readFile.mockResolvedValue(Buffer.from(['line1', 'line2', 'line3'].join(EOL)));
    (Uri.file as jest.Mock).mockReturnValue({
      fsPath: fixPath('/path/to/log')
    });
    const logUri = Uri.file(fixPath('/path/to/log'));
    const result = await readExtensionHostLog(logUri);
    expect(result).toEqual(['line1', 'line2', 'line3']);
  });

  it('should return empty array if readFile throws', async () => {
    vscodeMocked.fs.readFile.mockRejectedValue(new Error('File not found'));
    (Uri.file as jest.Mock).mockReturnValue({
      fsPath: fixPath('/path/to/log')
    });
    const logUri = Uri.file(fixPath('/path/to/log'));
    const result = await readExtensionHostLog(logUri);
    expect(result).toEqual([]);
  });
});

describe('getExtensionHostLogLocation', () => {
  it('should return log location', () => {
    (Uri.file as jest.Mock).mockReturnValue({
      fsPath: fixPath('/path/to/exthost/window1/a/b/c/some-ext.log')
    });
    const logUri = Uri.file(fixPath('/path/to/exthost/window1/a/b/c/some-ext.log'));
    const context = {
      logUri
    } as unknown as ExtensionContext;
    const result = getExtensionHostLogLocation(context);
    expect(result).toEqual(Uri.file(fixPath('/path/to/exthost')));
  });

  it('should return undefined if exthost directory not found', () => {
    (Uri.file as jest.Mock).mockReturnValue({
      fsPath: fixPath('/path/to/log')
    });
    const logUri = Uri.file(fixPath('/path/to/log'));
    const context = {
      logUri
    } as unknown as ExtensionContext;
    const result = getExtensionHostLogLocation(context);
    expect(result).toBeUndefined();
  });
});

describe('getExtensionHostLogActivationRecords', () => {
  it('should return activation records', async () => {
    // Replace process.kill with the mock function
    jest.spyOn(process, 'kill').mockImplementation(jest.fn());

    vscodeMocked.fs.readFile.mockResolvedValue(
      Buffer.from(
        [
          '2024-01-26 15:18:17.014 [info] Extension host with pid 3574 started',
          "2024-01-26 15:15:38.303 [info] ExtensionService#_doActivateExtension salesforce.salesforcedx-vscode-lightning, startup: true, activationEvent: 'workspaceContains:sfdx-project.json'"
        ].join(EOL)
      )
    );
    (Uri.file as jest.Mock).mockReturnValue({
      fsPath: fixPath('/path/to/exthost/log')
    });
    const logUri = Uri.file(fixPath('/path/to/exthost/log'));
    const context = {
      logUri
    } as unknown as ExtensionContext;
    const result = await getExtensionHostLogActivationRecords(context);
    expect(result).toEqual({
      'salesforce.salesforcedx-vscode-lightning': {
        dateTime: new Date('2024-01-26 15:15:38.303'),
        level: 'info',
        eventName: 'ExtensionService#_doActivateExtension',
        properties: {
          startup: 'true',
          activationEvent: "'workspaceContains:sfdx-project.json'"
        }
      }
    });
  });

  it('should return activation records for second block in log file', async () => {
    // Replace process.kill with the mock function
    const mockKill = jest.spyOn(process, 'kill').mockImplementation(jest.fn());

    vscodeMocked.fs.readFile.mockResolvedValue(
      Buffer.from(
        [
          '2024-01-25 15:18:17.014 [info] Extension host with pid 3574 started',
          "2024-01-25 15:15:38.303 [info] ExtensionService#_doActivateExtension salesforce.salesforcedx-vscode-lightning, startup: true, activationEvent: 'workspaceContains:sfdx-project.json'",
          '2024-01-26 15:18:17.014 [info] Extension host with pid 42 started',
          "2024-01-26 15:15:38.303 [info] ExtensionService#_doActivateExtension salesforce.salesforcedx-vscode-lightning, startup: true, activationEvent: 'workspaceContains:sfdx-project.json'"
        ].join(EOL)
      )
    );
    (Uri.file as jest.Mock).mockReturnValue({
      fsPath: fixPath('/path/to/exthost/log')
    });
    const logUri = Uri.file(fixPath('/path/to/exthost/log'));
    const context = {
      logUri
    } as unknown as ExtensionContext;
    const result = await getExtensionHostLogActivationRecords(context);
    expect(mockKill).toHaveBeenCalledTimes(1);
    expect(mockKill).toHaveBeenCalledWith(42, 0);
    expect(result).toEqual({
      'salesforce.salesforcedx-vscode-lightning': {
        dateTime: new Date('2024-01-26 15:15:38.303'),
        level: 'info',
        eventName: 'ExtensionService#_doActivateExtension',
        properties: {
          startup: 'true',
          activationEvent: "'workspaceContains:sfdx-project.json'"
        }
      }
    });
  });

  it('should return undefined when PID is not active', async () => {
    // Replace process.kill with the mock function
    jest.spyOn(process, 'kill').mockImplementation(() => {
      throw new Error('test pid not active');
    });

    vscodeMocked.fs.readFile.mockResolvedValue(
      Buffer.from(
        [
          '2024-01-16 15:18:17.014 [info] Extension host with pid 3574 started',
          "2024-01-26 15:15:38.303 [info] ExtensionService#_doActivateExtension salesforce.salesforcedx-vscode-lightning, startup: true, activationEvent: 'workspaceContains:sfdx-project.json'"
        ].join(EOL)
      )
    );
    (Uri.file as jest.Mock).mockReturnValue({
      fsPath: fixPath('/path/to/exthost/log')
    });
    const logUri = Uri.file(fixPath('/path/to/exthost/log'));
    const context = {
      logUri
    } as unknown as ExtensionContext;
    const result = await getExtensionHostLogActivationRecords(context);
    expect(result).toBeUndefined();
  });
});
