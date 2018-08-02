/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ReplaySubject } from 'rxjs/ReplaySubject';
import { assert, SinonStub, stub } from 'sinon';
import { CancellationTokenSource, window } from 'vscode';
import { DEFAULT_SFDX_CHANNEL } from '../../src/channels/channelService';
import { nls } from '../../src/messages';
import { NotificationService } from '../../src/notifications/notificationService';
import { SfdxCoreSettings } from '../../src/settings/sfdxCoreSettings';

const SHOW_BUTTON_TEXT = nls.localize('notification_show_button_text');
const SHOW_ONLY_STATUS_BAR_BUTTON_TEXT = nls.localize(
  'notification_show_in_status_bar_button_text'
);

// tslint:disable:no-empty
describe('Notifications', () => {
  let mShowInformation: SinonStub;
  let mShowWarningMessage: SinonStub;
  let mShowErrorMessage: SinonStub;
  let mShow: SinonStub;
  let mStatusBar: SinonStub;
  let settings: SinonStub;

  beforeEach(() => {
    mShow = stub(DEFAULT_SFDX_CHANNEL, 'show');
    mShowInformation = stub(window, 'showInformationMessage').returns(
      Promise.resolve(null)
    );
    mShowWarningMessage = stub(window, 'showWarningMessage').returns(
      Promise.resolve(null)
    );
    mShowErrorMessage = stub(window, 'showErrorMessage').returns(
      Promise.resolve(null)
    );
    mStatusBar = stub(window, 'setStatusBarMessage').returns(
      Promise.resolve(null)
    );
    settings = stub(SfdxCoreSettings.prototype, 'getShowCLISuccessMsg').returns(
      true
    );
  });

  afterEach(() => {
    mShow.restore();
    mShowInformation.restore();
    mShowWarningMessage.restore();
    mShowErrorMessage.restore();
    mStatusBar.restore();
    settings.restore();
  });

  it('Should notify successful execution', async () => {
    const observable = new ReplaySubject<number | undefined>();
    observable.next(0);

    const notificationService = NotificationService.getInstance();
    await notificationService.reportExecutionStatus('mock command', observable);

    assert.notCalled(mShow);
    assert.calledWith(
      mShowInformation,
      'mock command successfully ran',
      SHOW_BUTTON_TEXT,
      SHOW_ONLY_STATUS_BAR_BUTTON_TEXT
    );
    assert.notCalled(mShowWarningMessage);
    assert.notCalled(mShowErrorMessage);
    assert.notCalled(mStatusBar);
  });

  it('Should notify successful and show channel as requested', async () => {
    // For this particular test, we need it to return a different value
    mShowInformation.restore();
    mShowInformation = stub(window, 'showInformationMessage').returns(
      Promise.resolve(SHOW_BUTTON_TEXT)
    );
    const observable = new ReplaySubject<number | undefined>();
    observable.next(0);

    const notificationService = NotificationService.getInstance();
    await notificationService.reportExecutionStatus('mock command', observable);

    assert.calledOnce(mShow);
    assert.calledWith(
      mShowInformation,
      'mock command successfully ran',
      SHOW_BUTTON_TEXT,
      SHOW_ONLY_STATUS_BAR_BUTTON_TEXT
    );
    assert.notCalled(mShowWarningMessage);
    assert.notCalled(mShowErrorMessage);
    assert.notCalled(mStatusBar);
  });

  it('Should notify successful in status bar based on user configuration', async () => {
    // Set user configuration to show success messages in status bar.
    settings.restore();
    settings = stub(SfdxCoreSettings.prototype, 'getShowCLISuccessMsg').returns(
      false
    );

    const observable = new ReplaySubject<number | undefined>();
    observable.next(0);

    const notificationService = NotificationService.getInstance();
    await notificationService.reportExecutionStatus('mock command', observable);

    assert.notCalled(mShow);
    assert.notCalled(mShowInformation);
    assert.notCalled(mShowWarningMessage);
    assert.notCalled(mShowErrorMessage);
    assert.calledOnce(mStatusBar);
  });

  it('Should update setting to hide future information messages', async () => {
    // For this particular test, we need it to return a different value
    mShowInformation.restore();
    mShowInformation = stub(window, 'showInformationMessage').returns(
      Promise.resolve(SHOW_ONLY_STATUS_BAR_BUTTON_TEXT)
    );
    const updateSetting = stub(
      SfdxCoreSettings.prototype,
      'updateShowCLISuccessMsg'
    );
    const observable = new ReplaySubject<number | undefined>();
    observable.next(0);

    const notificationService = NotificationService.getInstance();
    await notificationService.reportExecutionStatus('mock command', observable);

    assert.calledWith(
      mShowInformation,
      'mock command successfully ran',
      SHOW_BUTTON_TEXT,
      SHOW_ONLY_STATUS_BAR_BUTTON_TEXT
    );
    assert.notCalled(mShow);
    assert.notCalled(mShowWarningMessage);
    assert.notCalled(mShowErrorMessage);
    assert.notCalled(mStatusBar);
    assert.calledOnce(updateSetting);
  });

  it('Should notify cancellation', async () => {
    const observable = new ReplaySubject<number | undefined>();
    const cancellationTokenSource = new CancellationTokenSource();

    const notificationService = NotificationService.getInstance();
    await notificationService.reportExecutionStatus(
      'mock command',
      observable,
      cancellationTokenSource.token
    );

    cancellationTokenSource.cancel();

    assert.calledOnce(mShow);
    assert.notCalled(mShowInformation);
    assert.calledWith(mShowWarningMessage, 'mock command was canceled');
    assert.notCalled(mShowErrorMessage);
  });

  it('Should notify unsuccessful execution', async () => {
    const ABNORMAL_EXIT = -1;
    const observable = new ReplaySubject<number | undefined>();
    observable.next(ABNORMAL_EXIT);

    const notificationService = NotificationService.getInstance();
    await notificationService.reportExecutionStatus('mock command', observable);

    assert.calledOnce(mShow);
    assert.notCalled(mShowInformation);
    assert.notCalled(mShowWarningMessage);
    assert.calledWith(mShowErrorMessage, 'mock command failed to run');
  });

  it('Should notify errorneous execution', async () => {
    const error = new Error('');
    const observable = new ReplaySubject<Error | undefined>();
    observable.next(error);

    const notificationService = NotificationService.getInstance();
    await notificationService.reportExecutionError('mock command', observable);

    assert.calledOnce(mShow);
    assert.notCalled(mShowInformation);
    assert.notCalled(mShowWarningMessage);
    assert.calledWith(mShowErrorMessage, 'mock command failed to run');
  });
});
