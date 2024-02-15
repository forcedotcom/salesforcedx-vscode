/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as sinon from 'sinon';
import { showError } from '../../../src/commands/commandUtils';
import {
  ChannelService,
  notificationService
} from '@salesforce/salesforcedx-utils-vscode';
import { telemetryService } from '../../../src/telemetry';

describe('command utilities', () => {
  describe('showError', () => {
    it('should call the telemetry service', async () => {
      const spy = sinon.spy(telemetryService, 'sendException');

      showError(
        new Error('test error message'),
        'lightning_lwc_start_test',
        'SFDX: Start Local Development Server'
      );

      sinon.assert.calledOnce(spy);
      sinon.assert.calledWith(
        spy,
        `lightning_lwc_start_test_error`,
        'test error message'
      );

      spy.restore();
    });

    it('should call the notification service', () => {
      const spy = sinon.spy(notificationService, 'showErrorMessage');

      showError(
        new Error('test error message'),
        'lightning_lwc_start_test',
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
      const spy = sinon.spy(ChannelService.prototype, 'appendLine');

      showError(
        new Error('test error message'),
        'lightning_lwc_start_test',
        'SFDX: Start Local Development Server'
      );

      sinon.assert.calledOnce(spy);
      sinon.assert.calledWith(spy, `Error: test error message`);

      spy.restore();
    });

    it('should show the channel output', () => {
      const spy = sinon.spy(ChannelService.prototype, 'showChannelOutput');

      showError(
        new Error('test error message'),
        'lightning_lwc_start_test',
        'SFDX: Start Local Development Server'
      );

      sinon.assert.calledOnce(spy);

      spy.restore();
    });
  });
});
