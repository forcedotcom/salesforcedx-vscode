/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Connection } from '@salesforce/core';
import { runQuery } from '../../../src/editor/queryRunner';

describe('runQuery ALL ROWS handling', () => {
  const makeConn = () => {
    const query = jest.fn().mockResolvedValue({ records: [], totalSize: 0, done: true });
    return { conn: { query } as unknown as Connection, query };
  };

  it('strips trailing ALL ROWS and passes scanAll true to conn.query', async () => {
    const { conn, query } = makeConn();
    await runQuery(conn)('SELECT Id FROM Account ALL ROWS', { showErrors: false });
    expect(query).toHaveBeenCalledWith('SELECT Id FROM Account', expect.objectContaining({ scanAll: true }));
  });

  it('passes scanAll false and unchanged text when ALL ROWS is absent', async () => {
    const { conn, query } = makeConn();
    await runQuery(conn)('SELECT Id FROM Account', { showErrors: false });
    expect(query).toHaveBeenCalledWith('SELECT Id FROM Account', expect.objectContaining({ scanAll: false }));
  });
});
