/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { CommandNudger } from '@salesforce/salesforcedx-utils-vscode/src/commands/commandNudger';
import * as vscode from 'vscode';
import { NotificationService, TelemetryService } from '../../../src';

const vscodeMocked = jest.mocked(vscode);

describe('CommandNudger', () => {
  let commandMock: jest.SpyInstance;
  let showInformationMessageMock: jest.SpyInstance;
  let sendCommandEventMock: jest.SpyInstance;

  beforeEach(() => {
    showInformationMessageMock = jest.spyOn(NotificationService.getInstance(), 'showInformationMessage');
    commandMock = jest.spyOn(vscodeMocked.commands, 'executeCommand');
    sendCommandEventMock = jest.spyOn(TelemetryService.getInstance(), 'sendCommandEvent');
  });

  it('should execute the command when the button is clicked', async () => {
    const options = {
      id: 'test.id',
      condition: () => true,
      message: 'Test message',
      buttonLabel: 'Test button',
      command: 'test.command'
    };
    const commandNudger = new CommandNudger(options);
    showInformationMessageMock.mockResolvedValue(options.buttonLabel);

    await commandNudger.execute();

    expect(commandMock.mock.calls.length).toBe(1);
    expect(commandMock.mock.calls[0].length).toBe(1);
    expect(commandMock.mock.calls[0][0]).toBe(options.command);
    expect(sendCommandEventMock.mock.calls.length).toBe(1);
    expect(sendCommandEventMock.mock.calls[0].length).toBe(3);
    expect(sendCommandEventMock.mock.calls[0][0]).toBe('nudge_command');
    expect(sendCommandEventMock.mock.calls[0][1]).toBeUndefined();
    expect(sendCommandEventMock.mock.calls[0][2]).toEqual({
      nudgeId: options.id,
      nudgeCommand: options.command,
      nudgeWorked: 'true'
    });
  });

  it('should not execute the command when the button is not clicked', async () => {
    const options = {
      id: 'test.id',
      condition: () => true,
      message: 'Test message',
      buttonLabel: 'Test button',
      command: 'test.command'
    };
    const commandNudger = new CommandNudger(options);
    showInformationMessageMock.mockResolvedValue(undefined);

    await commandNudger.execute();

    expect(commandMock.mock.calls.length).toBe(0);
    expect(sendCommandEventMock.mock.calls.length).toBe(1);
    expect(sendCommandEventMock.mock.calls[0].length).toBe(3);
    expect(sendCommandEventMock.mock.calls[0][0]).toBe('nudge_command');
    expect(sendCommandEventMock.mock.calls[0][1]).toBeUndefined();
    expect(sendCommandEventMock.mock.calls[0][2]).toEqual({
      nudgeId: options.id,
      nudgeCommand: options.command,
      nudgeWorked: 'false'
    });
  });

  it('should not execute the command when the condition is false', async () => {
    const options = {
      id: 'test.id',
      condition: () => false,
      message: 'Test message',
      buttonLabel: 'Test button',
      command: 'test.command'
    };
    const commandNudger = new CommandNudger(options);

    await commandNudger.execute();

    expect(commandMock.mock.calls.length).toBe(0);
    expect(sendCommandEventMock.mock.calls.length).toBe(0);
  });

});
