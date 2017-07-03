import { SinonStub, assert, stub } from 'sinon';
import { ReplaySubject } from 'rxjs/ReplaySubject';
import { CancellationTokenSource, window } from 'vscode';
import { NotificationService } from '../../src/notifications/notificationService';
import { DEFAULT_SFDX_CHANNEL } from '../../src/channels/channelService';
import { localize } from '../../src/messages';

const SHOW_BUTTON_TEXT = localize('notification_show_button_text');

// tslint:disable:no-empty
describe('Notifications', () => {
  let mShowInformation: SinonStub;
  let mShowWarningMessage: SinonStub;
  let mShowErrorMessage: SinonStub;
  let mShow: SinonStub;

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
  });

  afterEach(() => {
    mShow.restore();
    mShowInformation.restore();
    mShowWarningMessage.restore();
    mShowErrorMessage.restore();
  });

  it('Should notify successful execution', async () => {
    const observable = new ReplaySubject<number | string | null>();
    observable.next(0);

    const notificationService = NotificationService.getInstance();
    await notificationService.reportExecutionStatus('mock command', observable);

    assert.notCalled(mShow);
    assert.calledWith(
      mShowInformation,
      'Successfully executed mock command',
      SHOW_BUTTON_TEXT
    );
    assert.notCalled(mShowWarningMessage);
    assert.notCalled(mShowErrorMessage);
  });

  it('Should notify successful and show channel as requested', async () => {
    // For this particular test, we need it to return a different value
    mShowInformation.restore();
    mShowInformation = stub(window, 'showInformationMessage').returns(
      Promise.resolve(SHOW_BUTTON_TEXT)
    );
    const observable = new ReplaySubject<number | string | null>();
    observable.next(0);

    const notificationService = NotificationService.getInstance();
    await notificationService.reportExecutionStatus('mock command', observable);

    assert.calledOnce(mShow);
    assert.calledWith(
      mShowInformation,
      'Successfully executed mock command',
      SHOW_BUTTON_TEXT
    );
    assert.notCalled(mShowWarningMessage);
    assert.notCalled(mShowErrorMessage);
  });

  it('Should notify cancellation', async () => {
    const observable = new ReplaySubject<number | string | null>();
    observable.next(null);
    const cancellationTokenSource = new CancellationTokenSource();
    cancellationTokenSource.cancel();

    const notificationService = NotificationService.getInstance();
    await notificationService.reportExecutionStatus(
      'mock command',
      observable,
      cancellationTokenSource.token
    );

    assert.calledOnce(mShow);
    assert.notCalled(mShowInformation);
    assert.calledWith(mShowWarningMessage, 'mock command canceled');
    assert.notCalled(mShowErrorMessage);
  });

  it('Should notify unsuccessful execution', async () => {
    const ABNORMAL_EXIT = -1;
    const observable = new ReplaySubject<number | string | null>();
    observable.next(ABNORMAL_EXIT);

    const notificationService = NotificationService.getInstance();
    await notificationService.reportExecutionStatus('mock command', observable);

    assert.calledOnce(mShow);
    assert.notCalled(mShowInformation);
    assert.notCalled(mShowWarningMessage);
    assert.calledWith(mShowErrorMessage, 'Failed to execute mock command');
  });
});
