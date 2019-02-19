import { Disposable, StatusBarItem, window } from 'vscode';

export class StatusBarToggle implements Disposable {
  // @NOTE: I could also just turn these into an enum, let's see
  private static readonly watchCommand = 'sfdx.force.apex.colorizer';
  private static readonly removeCommand = 'sfdx.force.apex.colorizer.off';
  private static readonly watchText = '$(tasklist) Show Coverage';
  private static readonly removeText = '$(tasklist) Hide Coverage';
  private static readonly toolTip = 'Apex Code Coverage highlighter';
  private isEnabled: boolean;
  private statusBarItem: StatusBarItem;

  constructor() {
    // @NOTE: should probably change this since it makes apex code cov
    // highlighting be on by default.
    this.statusBarItem = window.createStatusBarItem();
    this.statusBarItem.command = StatusBarToggle.watchCommand;
    this.statusBarItem.text = StatusBarToggle.watchText;
    this.statusBarItem.tooltip = StatusBarToggle.toolTip;
    this.statusBarItem.show();
    this.isEnabled = false;
  }

  public get isHighlightingEnabled(): boolean {
    return this.isEnabled;
  }

  public toggle(active: boolean) {
    if (active) {
      this.statusBarItem.command = StatusBarToggle.removeCommand;
      this.statusBarItem.text = StatusBarToggle.removeText;
      this.isEnabled = true;
    } else {
      this.statusBarItem.command = StatusBarToggle.watchCommand;
      this.statusBarItem.text = StatusBarToggle.watchText;
      this.isEnabled = false;
    }
  }

  public dispose() {
    this.statusBarItem.dispose();
  }
}
