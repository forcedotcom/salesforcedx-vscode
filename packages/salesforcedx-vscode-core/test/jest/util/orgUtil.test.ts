/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthInfo } from '@salesforce/core-bundle';
import { ConfigUtil } from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';
import { channelService } from '../../../src/channels';
import { nls } from '../../../src/messages';
import { notificationService } from '../../../src/notifications';
import { OrgList } from '../../../src/orgPicker';
import { checkForSoonToBeExpiredOrgs } from '../../../src/util';

describe('orgUtil tests', () => {
  let showWarningMessageSpy: jest.SpyInstance;
  let appendLineSpy: jest.SpyInstance;
  let showChannelOutputSpy: jest.SpyInstance;
  let listAllAuthorizationsSpy: jest.SpyInstance;
  let authInfoCreateSpy: jest.SpyInstance;
  let createStatusBarItemMock: jest.SpyInstance;
  let createFileSystemWatcherMock: jest.SpyInstance;
  let getUsernameMock: jest.SpyInstance;
  let mockWatcher: any;

  const orgName1 = 'dreamhouse-org';
  const orgName2 = 'ebikes-lwc';
  const now = new Date();
  const threeDaysFromNow = new Date(now.getTime() + 24 * 3 * 60 * 60000);
  const yesterday = new Date(now.getTime() - 24 * 60 * 60000);

  beforeEach(() => {
    mockWatcher = {
      onDidChange: jest.fn(),
      onDidCreate: jest.fn(),
      onDidDelete: jest.fn()
    };
    createFileSystemWatcherMock = (vscode.workspace.createFileSystemWatcher as any).mockReturnValue(mockWatcher);
    createStatusBarItemMock = (vscode.window.createStatusBarItem as any).mockReturnValue({
      command: '',
      text: '',
      tooltip: '',
      show: jest.fn(),
      dispose: jest.fn()
    });
    showWarningMessageSpy = jest.spyOn(notificationService, 'showWarningMessage').mockImplementation(jest.fn());
    appendLineSpy = jest.spyOn(channelService, 'appendLine').mockImplementation(jest.fn());
    showChannelOutputSpy = jest.spyOn(channelService, 'showChannelOutput');
    listAllAuthorizationsSpy = jest.spyOn(AuthInfo, 'listAllAuthorizations');
    authInfoCreateSpy = jest.spyOn(AuthInfo, 'create');
    getUsernameMock = jest.spyOn(ConfigUtil, 'getUsername');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should not display a notification when no orgs are present', async () => {
    listAllAuthorizationsSpy.mockResolvedValue(undefined);
    const orgList = new OrgList();
    await checkForSoonToBeExpiredOrgs(orgList);

    expect(showWarningMessageSpy).not.toHaveBeenCalled();
    expect(appendLineSpy).not.toHaveBeenCalled();
    expect(showChannelOutputSpy).not.toHaveBeenCalled();
  });

  it('should not display a notification when dev hubs are present', async () => {
    listAllAuthorizationsSpy.mockResolvedValue([
      {
        isDevHub: true,
        username: 'foo',
        aliases: [orgName1]
      },
      {
        isDevHub: true,
        username: 'bar',
        aliases: [orgName2]
      }
    ]);
    const orgList = new OrgList();
    await checkForSoonToBeExpiredOrgs(orgList);

    expect(showWarningMessageSpy).not.toHaveBeenCalled();
    expect(appendLineSpy).not.toHaveBeenCalled();
    expect(showChannelOutputSpy).not.toHaveBeenCalled();
    expect(authInfoCreateSpy).not.toHaveBeenCalled();
  });

  it('should display a notification when the scratch org has already expired', async () => {
    listAllAuthorizationsSpy.mockResolvedValue([
      {
        isDevHub: false,
        username: 'foo',
        aliases: [orgName1]
      }
    ]);

    authInfoCreateSpy.mockResolvedValue({
      getFields: () => ({
        expirationDate: `${yesterday.getFullYear()}-${yesterday.getMonth() + 1}-${yesterday.getDate()}`
      })
    });
    getUsernameMock.mockResolvedValue('foo');

    const orgList = new OrgList();
    await checkForSoonToBeExpiredOrgs(orgList);

    expect(showWarningMessageSpy).toHaveBeenCalled();
    expect(appendLineSpy).not.toHaveBeenCalled();
    expect(showChannelOutputSpy).not.toHaveBeenCalled();
    expect(authInfoCreateSpy).toHaveBeenCalled();
  });

  it('should display a notification when the scratch org is about to expire', async () => {
    listAllAuthorizationsSpy.mockResolvedValue([
      {
        isDevHub: false,
        username: 'foo',
        aliases: [orgName1]
      }
    ]);

    authInfoCreateSpy.mockResolvedValue({
      getFields: () => ({
        expirationDate: `${threeDaysFromNow.getFullYear()}-${
          threeDaysFromNow.getMonth() + 1
        }-${threeDaysFromNow.getDate()}`
      })
    });

    const orgList = new OrgList();
    await checkForSoonToBeExpiredOrgs(orgList);

    expect(showWarningMessageSpy).toHaveBeenCalled();
    expect(appendLineSpy).toHaveBeenCalled();
    expect(appendLineSpy.mock.calls[0][0]).toContain(orgName1);
    expect(showChannelOutputSpy).toHaveBeenCalled();
  });

  it('should display multiple orgs in the output when there are several scratch orgs about to expire', async () => {
    listAllAuthorizationsSpy.mockResolvedValue([
      {
        isDevHub: false,
        username: 'foo',
        aliases: [orgName1]
      },
      {
        isDevHub: false,
        username: 'bar',
        aliases: [orgName2]
      }
    ]);

    authInfoCreateSpy.mockResolvedValue({
      getFields: () => ({
        expirationDate: `${threeDaysFromNow.getFullYear()}-${
          threeDaysFromNow.getMonth() + 1
        }-${threeDaysFromNow.getDate()}`
      })
    });

    const orgList = new OrgList();
    await checkForSoonToBeExpiredOrgs(orgList);

    expect(showWarningMessageSpy).toHaveBeenCalled();
    expect(appendLineSpy).toHaveBeenCalled();
    expect(appendLineSpy.mock.calls[0][0]).toContain(orgName1);
    expect(appendLineSpy.mock.calls[0][0]).toContain(orgName2);
    expect(showChannelOutputSpy).toHaveBeenCalled();
  });

  it('should display notifications for both an expired org and an org about to expire', async () => {
    const orgNameExpired = 'expired-org';
    const orgNameAboutToExpire = 'about-to-expire-org';

    // Define the expiration dates
    const expiredDate = new Date();
    expiredDate.setDate(expiredDate.getDate() - 1); // Expired
    const aboutToExpireDate = new Date();
    aboutToExpireDate.setDate(aboutToExpireDate.getDate() + 2); // About to expire

    // Mock listAllAuthorizations to return both expired and about-to-expire orgs
    listAllAuthorizationsSpy.mockResolvedValue([
      {
        isDevHub: false,
        username: 'about-to-expire-org@salesforce.com',
        aliases: [orgNameAboutToExpire]
      },
      {
        isDevHub: false,
        username: 'expired-org@salesforce.com',
        aliases: [orgNameExpired]
      }
    ]);

    // Mock authInfoCreate to return different expiration dates based on org name
    authInfoCreateSpy.mockResolvedValueOnce({
      getFields: () => ({
        expirationDate: `${aboutToExpireDate.getFullYear()}-${
          aboutToExpireDate.getMonth() + 1
        }-${aboutToExpireDate.getDate()}`
      })
    });
    authInfoCreateSpy.mockResolvedValueOnce({
      getFields: () => ({
        expirationDate: `${expiredDate.getFullYear()}-${expiredDate.getMonth() + 1}-${expiredDate.getDate()}`
      })
    });
    getUsernameMock.mockResolvedValue('expired-org@salesforce.com');

    const orgList = new OrgList();
    await checkForSoonToBeExpiredOrgs(orgList);

    // Assert that the notifications for both orgs are displayed
    expect(showWarningMessageSpy).toHaveBeenCalledTimes(2);
    expect(appendLineSpy).toHaveBeenCalled();
    expect(showChannelOutputSpy).toHaveBeenCalled();

    // Verify the specific calls
    const calls = showWarningMessageSpy.mock.calls.map(call => call[0]);
    expect(calls[0]).toContain(nls.localize('default_org_expired'));
    expect(calls[1]).toContain(
      'Warning: One or more of your orgs expire in the next 5 days. For more details, review the Output panel.'
    );
  });
});
