/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { PreviewQuickPickItem } from '../commands/forceLightningLwcPreview';
import { WorkspaceUtils } from '../util/workspaceUtils';

export class PreviewService {
  private rememberDeviceKey = 'preview.rememberDevice';
  private logLevelKey = 'preview.logLevel';
  private defaultLogLevel = 'warn';
  private previewOnMobileKey = 'preview.enableMobile';

  private static _instance: PreviewService;

  public static get instance() {
    if (PreviewService._instance === undefined) {
      PreviewService._instance = new PreviewService();
    }
    return PreviewService._instance;
  }

  public getRememberedDevice(platform: PreviewQuickPickItem): string {
    const store = WorkspaceUtils.getInstance().getGlobalStore();
    if (store === undefined) {
      return '';
    }

    return store.get(`last${platform.platformName}Device`) || '';
  }

  public updateRememberedDevice(
    platform: PreviewQuickPickItem,
    deviceName: string
  ) {
    const store = WorkspaceUtils.getInstance().getGlobalStore();
    if (store !== undefined) {
      store.update(`last${platform.platformName}Device`, deviceName);
    }
  }

  public isMobileEnabled(): boolean {
    return WorkspaceUtils.getInstance()
      .getWorkspaceSettings()
      .get(this.previewOnMobileKey, false);
  }

  public isRememberedDeviceEnabled(): boolean {
    return (
      WorkspaceUtils.getInstance()
        .getWorkspaceSettings()
        .get(this.rememberDeviceKey) || false
    );
  }

  public getLogLevel(): string {
    return (
      WorkspaceUtils.getInstance()
        .getWorkspaceSettings()
        .get(this.logLevelKey) || this.defaultLogLevel
    );
  }
}
