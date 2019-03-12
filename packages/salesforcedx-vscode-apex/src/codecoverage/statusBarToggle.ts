import { Disposable, StatusBarItem, window } from 'vscode';

export class StatusBarToggle implements Disposable {
  private static readonly toggleCodeCovCommand =
    'sfdx.force.apex.toggle.colorizer';
  private static readonly showIcon = '$(tasklist)';
  private static readonly hideIcon = '$(three-bars)';
  private static readonly toolTip = 'Apex Code Coverage highlighter';
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
