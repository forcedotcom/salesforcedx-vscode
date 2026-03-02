/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import { StatusBarToggle } from '../../../src/codecoverage/statusBarToggle';

describe('StatusBarToggle', () => {
  let statusBarToggle: StatusBarToggle;
  let mockStatusBarItem: {
    command: string;
    text: string;
    tooltip: string | undefined;
    show: jest.Mock;
    dispose: jest.Mock;
  };

  beforeEach(() => {
    mockStatusBarItem = {
      command: '',
      text: '',
      tooltip: undefined,
      show: jest.fn(),
      dispose: jest.fn()
    };
    jest
      .spyOn(vscode.window, 'createStatusBarItem')
      .mockReturnValue(mockStatusBarItem as unknown as vscode.StatusBarItem);
    statusBarToggle = new StatusBarToggle();
  });

  it('should create status bar item with toggle command and show icon', () => {
    expect(vscode.window.createStatusBarItem).toHaveBeenCalled();
    expect(mockStatusBarItem.command).toBe('sf.apex.toggle.colorizer');
    expect(mockStatusBarItem.text).toBe('$(three-bars)');
    expect(mockStatusBarItem.show).toHaveBeenCalled();
  });

  it('should report highlighting disabled initially', () => {
    expect(statusBarToggle.isHighlightingEnabled).toBe(false);
  });

  it('should update state and icon when toggled on', () => {
    statusBarToggle.toggle(true);
    expect(statusBarToggle.isHighlightingEnabled).toBe(true);
    expect(mockStatusBarItem.text).toBe('$(tasklist)');
  });

  it('should update state and icon when toggled off', () => {
    statusBarToggle.toggle(true);
    statusBarToggle.toggle(false);
    expect(statusBarToggle.isHighlightingEnabled).toBe(false);
    expect(mockStatusBarItem.text).toBe('$(three-bars)');
  });

  it('should dispose status bar item on dispose', () => {
    statusBarToggle.dispose();
    expect(mockStatusBarItem.dispose).toHaveBeenCalled();
  });
});
