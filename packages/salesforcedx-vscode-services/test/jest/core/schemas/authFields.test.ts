/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Option from 'effect/Option';
import { authFieldsFrom, authFieldsFromConnection, orgIdFromConnection } from '../../../../src/core/schemas/authFields';

const ORG_ID = '00D000000000001';

describe('AuthFields', () => {
  it('decodes the subset we read and ignores extra jsforce keys', () => {
    const fields = authFieldsFrom({
      orgId: ORG_ID,
      username: 'user@example.com',
      instanceName: 'USA9S',
      accessToken: 'secret',
      refreshToken: 'secret'
    });
    expect(Option.isSome(fields)).toBe(true);
    if (Option.isSome(fields)) {
      expect(fields.value.orgId).toEqual(Option.some(ORG_ID));
      expect(fields.value.username).toEqual(Option.some('user@example.com'));
      expect(fields.value.instanceName).toEqual(Option.some('USA9S'));
    }
  });

  it('allows missing orgId', () => {
    const fields = authFieldsFrom({ username: 'user@example.com' });
    expect(Option.isSome(fields)).toBe(true);
    if (Option.isSome(fields)) {
      expect(fields.value.orgId).toEqual(Option.none());
      expect(fields.value.username).toEqual(Option.some('user@example.com'));
    }
  });

  it('rejects a present but invalid orgId', () => {
    expect(authFieldsFrom({ orgId: 'org-one', username: 'user@example.com' })).toEqual(Option.none());
  });

  it('trims instanceName', () => {
    const fields = authFieldsFrom({ instanceName: '  USA9S  ' });
    expect(Option.isSome(fields)).toBe(true);
    if (Option.isSome(fields)) {
      expect(fields.value.instanceName).toEqual(Option.some('USA9S'));
    }
  });
});

describe('authFieldsFromConnection', () => {
  it('reads Connection.getAuthInfoFields()', () => {
    const connection = { getAuthInfoFields: () => ({ orgId: ORG_ID, instanceName: 'USA9S' }) };
    expect(orgIdFromConnection(connection)).toEqual(Option.some(ORG_ID));
    const fields = authFieldsFromConnection(connection);
    expect(Option.isSome(fields)).toBe(true);
    if (Option.isSome(fields)) {
      expect(fields.value.instanceName).toEqual(Option.some('USA9S'));
    }
  });

  it('returns none when orgId is not an OrgId', () => {
    const connection = { getAuthInfoFields: () => ({ orgId: 'org-one' }) };
    expect(authFieldsFromConnection(connection)).toEqual(Option.none());
    expect(orgIdFromConnection(connection)).toEqual(Option.none());
  });
});
