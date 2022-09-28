/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ReplaySubject } from 'rxjs/ReplaySubject';
import { assert, SinonStub, stub } from 'sinon';
import { OutputChannel } from 'vscode';
import * as vscode from 'vscode';
import { ChannelService, NotificationService } from '../../../src';
import { nls } from '../../../src/messages';
import { MockChannel } from './mocks';

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
  let mChannel;
  let channelService: ChannelService | undefined;

  beforeEach(() => {
    mShow = stub(ChannelService.prototype, 'showChannelOutput');
    mShowInformation = stub(vscode.window, 'showInformationMessage').returns(
      Promise.resolve(null)
    );
    mShowWarningMessage = stub(vscode.window, 'showWarningMessage').returns(
      Promise.resolve(null)
    );
    mShowErrorMessage = stub(vscode.window, 'showErrorMessage').returns(
      Promise.resolve(null)
    );
    mStatusBar = stub(vscode.window, 'setStatusBarMessage').returns(
      Promise.resolve(null)
    );
    settings = stub(vscode.workspace, 'getConfiguration');
    settings.returns({
      get: () => true,
      update: () => {}
    });
    mChannel = new MockChannel();
    channelService = new ChannelService(mChannel as OutputChannel);
  });

  afterEach(() => {
    mShow.restore();
    mShowInformation.restore();
    mShowWarningMessage.restore();
    mShowErrorMessage.restore();
    mStatusBar.restore();
    settings.restore();
  });

  it('Should notify successful execution', done => {
    const observable = new ReplaySubject<number | undefined>();
    observable.next(0);

    const notificationService = NotificationService.getInstance();
    notificationService.reportExecutionStatus(
      'mock command',
      channelService,
      observable
    );

    setTimeout(() => {
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
      done();
    }, 0);
  });

  it('Should notify successful and show channel as requested', async () => {
    // For this particular test, we need it to return a different value
    mShowInformation.restore();
    mShowInformation = stub(vscode.window, 'showInformationMessage').returns(
      Promise.resolve(SHOW_BUTTON_TEXT)
    );
    const observable = new ReplaySubject<number | undefined>();
    observable.next(0);

    const notificationService = NotificationService.getInstance();
    await notificationService.reportExecutionStatus(
      'mock command',
      channelService,
      observable
    );

    assert.calledWith(
      mShowInformation,
      'mock command successfully ran',
      SHOW_BUTTON_TEXT,
      SHOW_ONLY_STATUS_BAR_BUTTON_TEXT
    );
    assert.calledOnce(mShow);
    assert.notCalled(mShowWarningMessage);
    assert.notCalled(mShowErrorMessage);
    assert.notCalled(mStatusBar);
  });

  it('Should notify successful in status bar based on user configuration', done => {
    // Set user configuration to show success messages in status bar.
    settings.restore();
    settings = stub(vscode.workspace, 'getConfiguration');
    settings.returns({
      get: () => {
        return false;
      }
    });

    const observable = new ReplaySubject<number | undefined>();
    observable.next(0);

    const notificationService = NotificationService.getInstance();
    notificationService.reportExecutionStatus(
      'mock command',
      channelService,
      observable
    );

    setTimeout(() => {
      assert.notCalled(mShow);
      assert.notCalled(mShowInformation);
      assert.notCalled(mShowWarningMessage);
      assert.notCalled(mShowErrorMessage);
      assert.calledOnce(mStatusBar);
      done();
    }, 0);
  });

  it('Should update setting to hide future information messages', done => {
    // For this particular test, we need it to return a different value
    mShowInformation.restore();
    mShowInformation = stub(vscode.window, 'showInformationMessage').returns(
      Promise.resolve(SHOW_ONLY_STATUS_BAR_BUTTON_TEXT)
    );

    const updateSetting = stub();
    settings.returns({
      get: () => {
        return true;
      },
      update: updateSetting
    });
    const observable = new ReplaySubject<number | undefined>();
    observable.next(0);

    const notificationService = NotificationService.getInstance();
    notificationService.reportExecutionStatus(
      'mock command',
      channelService,
      observable
    );

    setTimeout(() => {
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
      done();
    }, 0);
  });

  it('Should notify cancellation', done => {
    const observable = new ReplaySubject<number | undefined>();
    let cancelCallback: undefined | (() => void);
    const cancellationTokenSource = {
      token: {
        isCancellationRequested: false,
        onCancellationRequested: (callback: () => void) => {
          cancelCallback = callback;
        }
      },
      cancel: jest.fn()
    };

    const notificationService = NotificationService.getInstance();
    notificationService.reportExecutionStatus(
      'mock command',
      channelService,
      observable,
      cancellationTokenSource.token as vscode.CancellationToken
    );

    cancellationTokenSource.cancel();
    if (cancelCallback) {
      cancelCallback();
    } else {
      fail('should have set the cancel callback.');
    }

    setTimeout(() => {
      assert.notCalled(mShow);
      assert.notCalled(mShowInformation);
      assert.calledWith(mShowWarningMessage, 'mock command was canceled');
      assert.notCalled(mShowErrorMessage);
      done();
    }, 0);
  });

  it('Should notify unsuccessful execution', done => {
    const ABNORMAL_EXIT = -1;
    const observable = new ReplaySubject<number | undefined>();
    observable.next(ABNORMAL_EXIT);

    const notificationService = NotificationService.getInstance();
    notificationService.reportExecutionStatus(
      'mock command',
      channelService,
      observable
    );

    setTimeout(() => {
      assert.notCalled(mShow);
      assert.notCalled(mShowInformation);
      assert.notCalled(mShowWarningMessage);
      assert.calledWith(mShowErrorMessage, 'mock command failed to run');
      done();
    }, 0);
  });

  it('Should notify errorneous execution', done => {
    const error = new Error('');
    const observable = new ReplaySubject<Error | undefined>();
    observable.next(error);

    const notificationService = NotificationService.getInstance();
    notificationService.reportExecutionError('mock command', observable);

    setTimeout(() => {
      assert.notCalled(mShow);
      assert.notCalled(mShowInformation);
      assert.notCalled(mShowWarningMessage);
      assert.calledWith(mShowErrorMessage, 'mock command failed to run');
      done();
    }, 0);
  });
});
