/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// Imports for testing
import { expect } from 'chai';
import { createSandbox, SinonSandbox, SinonSpy } from 'sinon';
import * as vscode from 'vscode';
import { checkForExpiredOrgs } from '../../../src/util';

// Imports from the target source file
import { AuthInfo } from '@salesforce/core';
import { channelService } from '../../../src/channels';
import { OrgList } from '../../../src/orgPicker';

describe('orgUtil tests', () => {
  let sb: SinonSandbox;

  beforeEach(() => {
    sb = createSandbox();
  });

  afterEach(async () => {
    sb.restore();
  });

  describe('checkForExpiredOrgs tests', () => {
    let today: Date;
    let showWarningMessageSpy: SinonSpy;
    let appendLineSpy: SinonSpy;
    let showChannelOutputSpy: SinonSpy;

    beforeEach(() => {
      today = new Date();
      showWarningMessageSpy = sb.spy(vscode.window, 'showWarningMessage');
      appendLineSpy = sb.spy(channelService, 'appendLine');
      showChannelOutputSpy = sb.spy(channelService, 'showChannelOutput');
    });

    afterEach(async () => {
      showWarningMessageSpy.restore();
      appendLineSpy.restore();
      showChannelOutputSpy.restore();
    });

    it('should not display a notification when no orgs are present', async () => {
      const orgList = new OrgList();
      await checkForExpiredOrgs(orgList);

      expect(showWarningMessageSpy.called).to.equal(false);
      expect(appendLineSpy.called).to.equal(false);
      expect(showChannelOutputSpy.called).to.equal(false);
    });

    it('should not display a notification when dev hubs are present', async () => {
      const orgList = new OrgList();
      await checkForExpiredOrgs(orgList);

      expect(showWarningMessageSpy.called).to.equal(false);
      expect(appendLineSpy.called).to.equal(false);
      expect(showChannelOutputSpy.called).to.equal(false);
   });

    it('should not display a notification when the scratch org has already expired', async () => {
      const orgList = new OrgList();
      await checkForExpiredOrgs(orgList);

      expect(showWarningMessageSpy.called).to.equal(false);
      expect(appendLineSpy.called).to.equal(false);
      expect(showChannelOutputSpy.called).to.equal(false);
    });

    it('should display a notification when the scratch org is about to expire', async () => {
      const orgName = 'dreamhouse-org';
      const listAllAuthorizationsStub = sb
        .stub(AuthInfo, 'listAllAuthorizations')
        .resolves([
          {
            isDevHub: false,
            username: 'foo',
            aliases: [
              orgName
            ]
          }
        ]);

      const authInfoCreateStub = sb
        .stub(AuthInfo, 'create')
        .resolves({
          getFields: () => {
            return {
              expirationDate: `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate() + 3}`
            };
          }
        });

      const orgList = new OrgList();
      await checkForExpiredOrgs(orgList);

      expect(showWarningMessageSpy.called).to.equal(true);
      expect(appendLineSpy.called).to.equal(true);
      expect(appendLineSpy.args[0][0]).to.contain(orgName);
      expect(showChannelOutputSpy.called).to.equal(true);

      authInfoCreateStub.restore();
      listAllAuthorizationsStub.restore();
    });

    it('should display multiple orgs in the output when there are several scratch orgs about to expire', async () => {
      const orgName1 = 'dreamhouse-org';
      const orgName2 = 'ebikes-lwc';
      const listAllAuthorizationsStub = sb
        .stub(AuthInfo, 'listAllAuthorizations')
        .resolves([
          {
            isDevHub: false,
            username: 'foo',
            aliases: [
              orgName1
            ]
          },
          {
            isDevHub: false,
            username: 'bar',
            aliases: [
              orgName2
            ]
          }
        ]);

      const authInfoCreateStub = sb
        .stub(AuthInfo, 'create')
        .resolves({
          getFields: () => {
            return {
              expirationDate: `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate() + 3}`
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

      authInfoCreateStub.restore();
      listAllAuthorizationsStub.restore();
    });
  });
});
