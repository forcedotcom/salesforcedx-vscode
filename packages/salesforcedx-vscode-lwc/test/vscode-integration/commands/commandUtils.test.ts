/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { showError } from '../../../src/commands/commandUtils';
import { channelService } from '@salesforce/salesforcedx-utils-vscode/out/src/channels';

const sfdxCoreExports = vscode.extensions.getExtension(
  'salesforce.salesforcedx-vscode-core'
)!.exports;
const { notificationService, telemetryService } = sfdxCoreExports;

describe('command utilities', () => {
  describe('showError', () => {
    it('should call the telemetry service', async () => {
      const spy = sinon.spy(telemetryService, 'sendException');

      showError(
        new Error('test error message'),
        'force_lightning_lwc_start_test',
        'SFDX: Start Local Development Server'
      );

      sinon.assert.calledOnce(spy);
      sinon.assert.calledWith(
        spy,
        `force_lightning_lwc_start_test_error`,
        'test error message'
      );

      spy.restore();
    });

    it('should call the notification service', () => {
      const spy = sinon.spy(notificationService, 'showErrorMessage');

      showError(
        new Error('test error message'),
        'force_lightning_lwc_start_test',
        'SFDX: Start Local Development Server'
      );

      sinon.assert.calledTwice(spy);
      sinon.assert.calledWith(
        spy,
        sinon.match('SFDX: Start Local Development Server')
      );

      spy.restore();
    });

    it('should send a message to the channel', () => {
      const spy = sinon.spy(channelService, 'appendLine');

      showError(
        new Error('test error message'),
        'force_lightning_lwc_start_test',
        'SFDX: Start Local Development Server'
      );

      sinon.assert.calledOnce(spy);
      sinon.assert.calledWith(spy, `Error: test error message`);

      spy.restore();
    });

    it('should show the channel output', () => {
      const spy = sinon.spy(channelService, 'showChannelOutput');

      showError(
        new Error('test error message'),
        'force_lightning_lwc_start_test',
        'SFDX: Start Local Development Server'
      );

      sinon.assert.calledOnce(spy);

      spy.restore();
    });
  });
});
