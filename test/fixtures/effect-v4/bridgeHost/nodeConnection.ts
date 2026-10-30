/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { AuthInfo, Connection, Org } from '@salesforce/core';

export const createOfflineConnection = async () => {
  const authInfo = await AuthInfo.create({ username: '00D000000000001!offline' });
  // Avoid Org.create enrichment: this is a real SDK Connection, without network or auth-file writes.
  authInfo.update({ orgEdition: 'Developer', namespacePrefix: '' });
  const connection = await Connection.create({ authInfo, connectionOptions: { version: '65.0' } });
  const org = await Org.create({ connection });
  if (org.getConnection() !== connection) throw new Error('Org replaced its provided Connection');
  return connection;
};
