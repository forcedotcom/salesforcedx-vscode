/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Connection } from '@salesforce/core';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { EOL, tmpdir } from 'node:os';
import { join } from 'node:path';
import * as readline from 'node:readline';
import { PassThrough } from 'node:stream';
import { ExecuteService } from '../../src/execute/executeService';
import { nls } from '../../src/i18n';

vi.mock(import('node:readline'), async importOriginal => ({
  ...(await importOriginal()),
  createInterface: vi.fn()
}));

const response = {
  'soapenv:Envelope': {
    'soapenv:Body': {
      executeAnonymousResponse: {
        result: {
          compiled: 'true',
          success: 'true',
          line: -1,
          column: -1,
          compileProblem: '',
          exceptionMessage: '',
          exceptionStackTrace: ''
        }
      }
    }
  }
};

describe('ExecuteService legacy input compatibility', () => {
  let directory: string;
  let input: PassThrough;
  let readInterface: readline.Interface;
  let request: ReturnType<typeof vi.fn>;
  let service: ExecuteService;

  beforeEach(async () => {
    directory = mkdtempSync(join(tmpdir(), 'apex-execute-input-'));
    input = new PassThrough();
    const actualReadline = await vi.importActual<typeof readline>('node:readline');
    readInterface = actualReadline.createInterface({ input });
    vi.mocked(readline.createInterface).mockReturnValue(readInterface);
    request = vi.fn().mockResolvedValue(response);
    service = new ExecuteService({
      accessToken: '00D-org!token',
      instanceUrl: 'https://example.my.salesforce.com',
      version: '65.0',
      request
    } as unknown as Connection);
    vi.spyOn(process.stdout, 'write').mockReturnValue(true);
  });

  afterEach(() => {
    readInterface.close();
    input.destroy();
    vi.useRealTimers();
    vi.restoreAllMocks();
    rmSync(directory, { recursive: true, force: true });
  });

  it('reads UTF-8 source from the CLI file option', async () => {
    const apexFilePath = join(directory, 'source.apex');
    writeFileSync(apexFilePath, "System.debug('héllo');");

    await expect(service.executeAnonymous({ apexFilePath })).resolves.toMatchObject({ success: true });

    expect(request.mock.calls[0][0].body).toContain('System.debug(&apos;héllo&apos;);');
  });

  it('preserves the file-not-found error without making a request', async () => {
    const apexFilePath = join(directory, 'missing.apex');

    await expect(service.executeAnonymous({ apexFilePath })).rejects.toEqual(
      new Error(nls.localize('fileNotFoundError', apexFilePath))
    );
    expect(request).not.toHaveBeenCalled();
  });

  it('prefers explicit source to a file or terminal input', async () => {
    await service.executeAnonymous({ apexCode: 'System.debug(1);', apexFilePath: 'missing.apex', userInput: true });

    expect(request.mock.calls[0][0].body).toContain('System.debug(1);');
    expect(readline.createInterface).not.toHaveBeenCalled();
  });

  it('collects piped stdin and preserves the prompt and platform line endings', async () => {
    const execution = service.executeAnonymous({ userInput: true });
    input.end('System.debug(1);\nSystem.debug(2);');

    await expect(execution).resolves.toMatchObject({ success: true });
    expect(process.stdout.write).toHaveBeenCalledWith(nls.localize('execAnonInputPrompt'));
    expect(request.mock.calls[0][0].body).toContain(`System.debug(1);${EOL}System.debug(2);${EOL}`);
  });

  it('refreshes the 60-second idle timeout after each interactive line', async () => {
    vi.useFakeTimers();
    const execution = service.executeAnonymous({ userInput: true });
    await vi.advanceTimersByTimeAsync(59_000);
    input.write('System.debug(1);\n');
    await vi.advanceTimersByTimeAsync(59_000);
    input.end('System.debug(2);\n');

    await expect(execution).resolves.toMatchObject({ success: true });
    expect(request.mock.calls[0][0].body).toContain(`System.debug(1);${EOL}System.debug(2);${EOL}`);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('preserves the idle timeout error and closes input without making a request', async () => {
    vi.useFakeTimers();
    const execution = expect(service.executeAnonymous({ userInput: true })).rejects.toEqual(
      new Error(nls.localize('execAnonInputTimeout'))
    );
    const close = vi.fn();
    readInterface.on('close', close);
    await vi.advanceTimersByTimeAsync(60_000);

    await execution;
    expect(close).toHaveBeenCalledOnce();
    expect(request).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('preserves terminal input errors without making a request', async () => {
    const execution = expect(service.executeAnonymous({ userInput: true })).rejects.toEqual(
      new Error(nls.localize('unexpectedExecAnonInputError', 'input failed'))
    );
    input.emit('error', new Error('input failed'));

    await execution;
    expect(request).not.toHaveBeenCalled();
  });

  it('preserves the missing-input error without making a request', async () => {
    await expect(service.executeAnonymous({})).rejects.toEqual(new Error(nls.localize('optionExecAnonError')));
    expect(request).not.toHaveBeenCalled();
  });
});
