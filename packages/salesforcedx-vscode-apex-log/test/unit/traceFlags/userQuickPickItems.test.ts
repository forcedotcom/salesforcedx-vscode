/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import {
  buildUserQuickPickItems,
  type UserRecord
} from '../../../src/traceFlags/traceFlagJsonSync';

const makeUser = (id: string, userType: string, overrides: Partial<UserRecord> = {}): UserRecord => ({
  Id: id,
  FirstName: 'First',
  LastName: 'Last',
  Username: `${id}@example.com`,
  UserType: userType,
  ...overrides
});

const separators = (items: vscode.QuickPickItem[]) =>
  items.filter(item => item.kind === vscode.QuickPickItemKind.Separator);

const users = (items: vscode.QuickPickItem[]) =>
  items.filter((item): item is vscode.QuickPickItem & { userId: string } => 'userId' in item);

describe('buildUserQuickPickItems', () => {
  it('groups populated sections in fixed order', () => {
    const items = buildUserQuickPickItems(
      [
        makeUser('other', 'Unknown'),
        makeUser('guest', 'Guest'),
        makeUser('customer', 'CustomerSuccess'),
        makeUser('partner', 'PowerPartner'),
        makeUser('automated', 'AutomatedProcess'),
        makeUser('standard', 'Standard')
      ],
      'current'
    );

    expect(separators(items).map(item => item.label)).toEqual([
      'Users (Standard)',
      'Automated Process',
      'Partner',
      'Customer/Portal',
      'Guest',
      'Other'
    ]);
  });

  it('sorts users by last and first name while retaining picker metadata', () => {
    const items = buildUserQuickPickItems(
      [
        makeUser('zoe', 'Standard', { FirstName: 'Zoe', LastName: 'Adams' }),
        makeUser('amy', 'Standard', { FirstName: 'Amy', LastName: 'Adams' }),
        makeUser('bob', 'Standard', { FirstName: 'Bob', LastName: 'Baker' })
      ],
      'current'
    );

    expect(users(items)).toEqual([
      {
        label: 'Amy Adams',
        description: 'amy@example.com  (Standard)',
        userId: 'amy'
      },
      {
        label: 'Zoe Adams',
        description: 'zoe@example.com  (Standard)',
        userId: 'zoe'
      },
      {
        label: 'Bob Baker',
        description: 'bob@example.com  (Standard)',
        userId: 'bob'
      }
    ]);
  });

  it.each([
    ['Standard', 'Users (Standard)'],
    ['AutomatedProcess', 'Automated Process'],
    ['PowerPartner', 'Partner'],
    ['PowerCustomerSuccess', 'Customer/Portal'],
    ['CustomerSuccess', 'Customer/Portal'],
    ['CsnOnly', 'Customer/Portal'],
    ['CspLitePortal', 'Customer/Portal'],
    ['SelfService', 'Customer/Portal'],
    ['Guest', 'Guest'],
    ['UnknownType', 'Other'],
    ['', 'Other']
  ])('maps %s to the %s section', (userType, expectedSection) => {
    const items = buildUserQuickPickItems([makeUser('user', userType)], 'current');

    expect(separators(items).map(item => item.label)).toEqual([expectedSection]);
  });

  it('excludes the current user without retaining an empty section', () => {
    const items = buildUserQuickPickItems(
      [makeUser('current', 'Standard'), makeUser('guest', 'Guest')],
      'current'
    );

    expect(separators(items).map(item => item.label)).toEqual(['Guest']);
    expect(users(items).map(item => item.userId)).toEqual(['guest']);
  });

  it('adds no icons or icon-prefixed labels', () => {
    const items = buildUserQuickPickItems([makeUser('user', 'Standard')], 'current');

    expect(items.every(item => !('iconPath' in item) && !item.label.startsWith('$('))).toBe(true);
  });
});
