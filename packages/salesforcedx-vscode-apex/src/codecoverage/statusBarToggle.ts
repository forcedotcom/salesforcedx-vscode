/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Disposable, StatusBarItem, window } from 'vscode';
import { nls } from '../messages';

export class StatusBarToggle implements Disposable {
  private static readonly toggleCodeCovCommand = 'sf.apex.toggle.colorizer';
  private static readonly showIcon = '$(three-bars)';
  private static readonly hideIcon = '$(tasklist)';
  private static readonly toolTip = nls.localize('colorizer_statusbar_hover_text');
  private isEnabled: boolean;
  private statusBarItem: StatusBarItem;

  constructor() {
    this.statusBarItem = window.createStatusBarItem();
    this.statusBarItem.command = StatusBarToggle.toggleCodeCovCommand;
    this.statusBarItem.text = StatusBarToggle.showIcon;
    this.statusBarItem.tooltip = StatusBarToggle.toolTip;
    this.statusBarItem.show();
    this.isEnabled = false;
  }

  public get isHighlightingEnabled(): boolean {
    return this.isEnabled;
  }

  public toggle(active: boolean) {
    if (active) {
      this.statusBarItem.text = StatusBarToggle.hideIcon;
      this.isEnabled = true;
    } else {
      this.statusBarItem.text = StatusBarToggle.showIcon;
      this.isEnabled = false;
    }
  }

  public dispose() {
    this.statusBarItem.dispose();
  }
}
