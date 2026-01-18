/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';

/** Persisted filter state keys */
const STORAGE_KEY = 'orgBrowser.filterState';

/** Filter state shape */
export type FilterState = {
  showLocalOnly: boolean;
  hideManaged: boolean;
  searchQuery: string;
};

const DEFAULT_STATE: FilterState = {
  showLocalOnly: false,
  hideManaged: false,
  searchQuery: ''
};

/** Callback type for filter state changes */
export type FilterStateChangeCallback = (state: FilterState) => void;

/** Service for managing filter state with workspace persistence */
export class FilterStateService {
  private state: FilterState;
  private readonly workspaceState: vscode.Memento;
  private readonly changeCallbacks: Set<FilterStateChangeCallback> = new Set();

  constructor(workspaceState: vscode.Memento) {
    this.workspaceState = workspaceState;
    this.state = this.loadState();
  }

  /** Load state from workspace storage */
  private loadState(): FilterState {
    const stored = this.workspaceState.get<Partial<FilterState>>(STORAGE_KEY);
    return { ...DEFAULT_STATE, ...stored };
  }

  /** Persist state to workspace storage */
  private async saveState(): Promise<void> {
    await this.workspaceState.update(STORAGE_KEY, this.state);
  }

  /** Notify all registered callbacks of state change */
  private notifyChange(): void {
    this.changeCallbacks.forEach(callback => callback(this.state));
  }

  /** Get current filter state */
  public getState(): FilterState {
    return { ...this.state };
  }

  /** Toggle showLocalOnly filter */
  public async toggleShowLocalOnly(): Promise<void> {
    this.state = { ...this.state, showLocalOnly: !this.state.showLocalOnly };
    await this.updateContextKeys();
    await this.saveState();
    this.notifyChange();
  }

  /** Toggle hideManaged filter */
  public async toggleHideManaged(): Promise<void> {
    this.state = { ...this.state, hideManaged: !this.state.hideManaged };
    await this.updateContextKeys();
    await this.saveState();
    this.notifyChange();
  }

  /** Set search query */
  public async setSearchQuery(query: string): Promise<void> {
    this.state = { ...this.state, searchQuery: query };
    await this.updateContextKeys();
    await this.saveState();
    this.notifyChange();
  }

  /** Clear search query */
  public async clearSearch(): Promise<void> {
    await this.setSearchQuery('');
  }

  /** Register a callback for state changes */
  public onChange(callback: FilterStateChangeCallback): vscode.Disposable {
    this.changeCallbacks.add(callback);
    return {
      dispose: (): void => {
        this.changeCallbacks.delete(callback);
      }
    };
  }

  /** Update VS Code context keys for menu when clauses */
  private async updateContextKeys(): Promise<void> {
    await vscode.commands.executeCommand('setContext', 'sfdxOrgBrowser.showLocalOnly', this.state.showLocalOnly);
    await vscode.commands.executeCommand('setContext', 'sfdxOrgBrowser.hideManaged', this.state.hideManaged);
    await vscode.commands.executeCommand(
      'setContext',
      'sfdxOrgBrowser.hasSearchQuery',
      this.state.searchQuery.length > 0
    );
  }

  /** Initialize context keys on startup */
  public async initializeContextKeys(): Promise<void> {
    await this.updateContextKeys();
  }
}
