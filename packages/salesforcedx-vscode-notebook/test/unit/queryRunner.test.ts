/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

vi.mock('vscode', () => ({
  env: { language: 'en' },
  workspace: {
    getConfiguration: vi.fn()
  }
}));

import * as vscode from 'vscode';
import {
  DEFAULT_MAX_QUERY_LIMIT,
  getMaxQueryLimit,
  type QueryConnection,
  type QueryRunnerDeps,
  runSoqlCellQuery
} from '../../src/queryRunner';

const queryResult = {
  totalSize: 1,
  done: true,
  records: [{ attributes: { type: 'Account' }, Id: '001000000000001' }]
};

const setup = (maxQueryLimit = 200): { connection: QueryConnection; deps: QueryRunnerDeps } => {
  const connection: QueryConnection = {
    query: vi.fn().mockResolvedValue(queryResult),
    toolingQuery: vi.fn().mockResolvedValue(queryResult)
  };

  return {
    connection,
    deps: {
      getConnection: vi.fn().mockResolvedValue(connection),
      getMaxQueryLimit: vi.fn().mockReturnValue(maxQueryLimit)
    }
  };
};

describe('SOQL cell query runner', () => {
  it('maps ALL ROWS to scanAll and removes it from the query', async () => {
    const { connection, deps } = setup();

    await expect(runSoqlCellQuery('SELECT Id FROM Account ALL ROWS', 'rest', deps)).resolves.toEqual({
      totalSize: 1,
      done: true,
      records: [{ Id: '001000000000001' }]
    });
    expect(connection.query).toHaveBeenCalledWith('SELECT Id FROM Account', {
      autoFetch: true,
      maxFetch: 200,
      scanAll: true
    });
  });

  it('uses scanAll false when ALL ROWS is absent', async () => {
    const { connection, deps } = setup();

    await runSoqlCellQuery('SELECT Id FROM Account', 'rest', deps);

    expect(connection.query).toHaveBeenCalledWith('SELECT Id FROM Account', {
      autoFetch: true,
      maxFetch: 200,
      scanAll: false
    });
  });

  it('uses the injected maximum query limit for maxFetch', async () => {
    const { connection, deps } = setup(321);

    await runSoqlCellQuery('SELECT Id FROM Account', 'rest', deps);

    expect(connection.query).toHaveBeenCalledWith('SELECT Id FROM Account', expect.objectContaining({ maxFetch: 321 }));
  });

  it.each(['', '  \n\t'])('rejects empty SOQL %#', async queryText => {
    const { connection, deps } = setup();

    await expect(runSoqlCellQuery(queryText, 'rest', deps)).rejects.toThrow('SOQL cell is empty.');
    expect(connection.query).not.toHaveBeenCalled();
  });

  it('strips header comments before querying', async () => {
    const { connection, deps } = setup();

    await runSoqlCellQuery('// notebook query\n// active accounts\nSELECT Id FROM Account', 'rest', deps);

    expect(connection.query).toHaveBeenCalledWith(
      'SELECT Id FROM Account',
      expect.objectContaining({ scanAll: false })
    );
  });

  it('surfaces query errors', async () => {
    const queryError = new Error('query failed');
    const { connection, deps } = setup();
    vi.mocked(connection.query).mockRejectedValue(queryError);

    await expect(runSoqlCellQuery('SELECT Id FROM Account', 'rest', deps)).rejects.toBe(queryError);
  });

  it('uses toolingQuery when Tooling API is selected', async () => {
    const { connection, deps } = setup();

    await runSoqlCellQuery('SELECT Id FROM ApexClass', 'tooling', deps);

    expect(connection.toolingQuery).toHaveBeenCalledWith(
      'SELECT Id FROM ApexClass',
      expect.objectContaining({ scanAll: false })
    );
    expect(connection.query).not.toHaveBeenCalled();
  });
});

describe('maximum query limit setting', () => {
  it('reads the notebook maximum query limit setting', () => {
    vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
      get: vi.fn().mockReturnValue(1234)
    } as unknown as vscode.WorkspaceConfiguration);

    expect(getMaxQueryLimit()).toBe(1234);
    expect(vscode.workspace.getConfiguration).toHaveBeenCalledWith('salesforcedx-vscode-notebook');
  });

  it('uses the default when the setting is unavailable', () => {
    vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
      get: vi.fn().mockReturnValue(undefined)
    } as unknown as vscode.WorkspaceConfiguration);

    expect(getMaxQueryLimit()).toBe(DEFAULT_MAX_QUERY_LIMIT);
  });
});
