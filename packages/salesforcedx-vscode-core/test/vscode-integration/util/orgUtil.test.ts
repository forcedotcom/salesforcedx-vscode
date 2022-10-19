/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// Imports for testing
import { expect } from 'chai';
import { createSandbox, SinonSandbox, SinonSpy, SinonStub } from 'sinon';
import * as vscode from 'vscode';
import { checkForExpiredOrgs } from '../../../src/util';

// Imports from the target source file
import { AuthInfo } from '@salesforce/core';
import { channelService } from '../../../src/channels';
import { OrgList } from '../../../src/orgPicker';

describe('orgUtil tests', () => {
  let sb: SinonSandbox;
  before(() => {
    sb = createSandbox();
  });

  afterEach(async () => {
    sb.restore();
  });

  describe('checkForExpiredOrgs tests', () => {
    const orgName1 = 'dreamhouse-org';
    const orgName2 = 'ebikes-lwc';
    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + 24 * 3 * 60 * 60000);
    const yesterday = new Date(now.getTime() - 24 * 60 * 60000);

    let showWarningMessageSpy: SinonSpy;
    let appendLineSpy: SinonSpy;
    let showChannelOutputSpy: SinonSpy;
    let listAllAuthorizationsStub: SinonStub;
    let authInfoCreateStub: SinonStub;

    beforeEach(() => {
      showWarningMessageSpy = sb.spy(vscode.window, 'showWarningMessage');
      appendLineSpy = sb.spy(channelService, 'appendLine');
      showChannelOutputSpy = sb.spy(channelService, 'showChannelOutput');
      listAllAuthorizationsStub = sb.stub(AuthInfo, 'listAllAuthorizations');
      authInfoCreateStub = sb.stub(AuthInfo, 'create');
    });

    it('should not display a notification when no orgs are present', async () => {
      listAllAuthorizationsStub.resolves(undefined);
      const orgList = new OrgList();
      await checkForExpiredOrgs(orgList);

      expect(showWarningMessageSpy.called).to.equal(false);
      expect(appendLineSpy.called).to.equal(false);
      expect(showChannelOutputSpy.called).to.equal(false);
    });

    it('should not display a notification when dev hubs are present', async () => {
      listAllAuthorizationsStub.resolves([
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
      await checkForExpiredOrgs(orgList);

      expect(showWarningMessageSpy.called).to.equal(false);
      expect(appendLineSpy.called).to.equal(false);
      expect(showChannelOutputSpy.called).to.equal(false);
      expect(authInfoCreateStub.called).to.equal(false);
    });

    it('should not display a notification when the scratch org has already expired', async () => {
      listAllAuthorizationsStub.resolves([
        {
          isDevHub: false,
          username: 'foo',
          aliases: [orgName1]
        }
      ]);

      authInfoCreateStub.resolves({
        getFields: () => {
          return {
            expirationDate: `${yesterday.getFullYear()}-${yesterday.getMonth() +
              1}-${yesterday.getDate()}`
          };
        }
      });
      const orgList = new OrgList();
      await checkForExpiredOrgs(orgList);

      expect(showWarningMessageSpy.called).to.equal(false);
      expect(appendLineSpy.called).to.equal(false);
      expect(showChannelOutputSpy.called).to.equal(false);
      expect(authInfoCreateStub.called).to.equal(true);
    });

    it('should display a notification when the scratch org is about to expire', async () => {
      const orgName = 'dreamhouse-org';
      listAllAuthorizationsStub.resolves([
        {
          isDevHub: false,
          username: 'foo',
          aliases: [orgName]
        }
      ]);

      authInfoCreateStub.resolves({
        getFields: () => {
          return {
            expirationDate: `${threeDaysFromNow.getFullYear()}-${threeDaysFromNow.getMonth() +
              1}-${threeDaysFromNow.getDate()}`
          };
        }
      });

      const orgList = new OrgList();
      await checkForExpiredOrgs(orgList);

      expect(showWarningMessageSpy.called).to.equal(true);
      expect(appendLineSpy.called).to.equal(true);
      expect(appendLineSpy.args[0][0]).to.contain(orgName);
      expect(showChannelOutputSpy.called).to.equal(true);
    });

    it('should display multiple orgs in the output when there are several scratch orgs about to expire', async () => {
      listAllAuthorizationsStub.resolves([
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

      authInfoCreateStub.resolves({
        getFields: () => {
          return {
            expirationDate: `${threeDaysFromNow.getFullYear()}-${threeDaysFromNow.getMonth() +
              1}-${threeDaysFromNow.getDate()}`
          };
        }
      });

      const orgList = new OrgList();
      await checkForExpiredOrgs(orgList);

      expect(showWarningMessageSpy.called).to.equal(true);
      expect(appendLineSpy.called).to.equal(true);
      expect(appendLineSpy.args[0][0]).to.contain(orgName1);
      expect(appendLineSpy.args[0][0]).to.contain(orgName2);
      expect(showChannelOutputSpy.called).to.equal(true);
    });
  });
});
