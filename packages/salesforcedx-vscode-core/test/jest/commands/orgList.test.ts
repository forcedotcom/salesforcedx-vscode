/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthRemover, AuthInfo } from '@salesforce/core-bundle';
import { notificationService } from '@salesforce/salesforcedx-utils-vscode';
import { channelService } from '../../../src/channels';
import { formatTimeDifference } from '../../../src/commands/orgList';
import { nls } from '../../../src/messages';
import { getAuthFieldsFor } from '../../../src/util/orgUtil';

// Mock the dependencies
jest.mock('@salesforce/core-bundle');
jest.mock('@salesforce/salesforcedx-utils-vscode', () => ({
  notificationService: {
    showSuccessfulExecution: jest.fn()
  },
  SfWorkspaceChecker: jest.fn(),
  ContinueResponse: jest.fn(),
  LibraryCommandletExecutor: jest.fn()
}));
jest.mock('../../../src/channels', () => ({
  channelService: {
    appendLine: jest.fn()
  },
  OUTPUT_CHANNEL: {}
}));
jest.mock('../../../src/telemetry', () => ({
  telemetryService: {
    sendException: jest.fn()
  }
}));
jest.mock('../../../src/util/orgUtil', () => ({
  getAuthFieldsFor: jest.fn()
}));
jest.mock('../../../src/messages', () => ({
  nls: {
    localize: jest.fn()
  }
}));
jest.mock('../../../src/commands/util', () => ({
  PromptConfirmGatherer: jest.fn(),
  SfCommandlet: jest.fn()
}));

describe('orgList command', () => {
  beforeEach(() => {
    // Mock nls.localize
    (nls.localize as jest.Mock).mockImplementation((key: string, ...args: string[]) => `${key}_${args.join('_')}`);

    // Reset all mocks
    jest.clearAllMocks();
  });

  it('should be a simple smoke test to verify basic functionality', () => {
    // Basic test to ensure the command structure is correct
    expect(typeof getAuthFieldsFor).toBe('function');
    expect(channelService.appendLine).toBeDefined();
    expect(notificationService.showSuccessfulExecution).toBeDefined();
    expect(AuthInfo.listAllAuthorizations).toBeDefined();
    expect(AuthRemover.create).toBeDefined();
  });

  describe('formatTimeDifference', () => {
    it('should format minutes only', () => {
      const result = formatTimeDifference(45 * 60 * 1000); // 45 minutes
      expect(result).toBe('45 minutes');
    });

    it('should format single minute', () => {
      const result = formatTimeDifference(1 * 60 * 1000); // 1 minute
      expect(result).toBe('1 minute');
    });

    it('should format hours and minutes', () => {
      const result = formatTimeDifference(2.5 * 60 * 60 * 1000); // 2 hours 30 minutes
      expect(result).toBe('2 hours, 30 minutes');
    });

    it('should format single hour and single minute', () => {
      const result = formatTimeDifference(1 * 60 * 60 * 1000 + 1 * 60 * 1000); // 1 hour 1 minute
      expect(result).toBe('1 hour, 1 minute');
    });

    it('should format hours only', () => {
      const result = formatTimeDifference(5 * 60 * 60 * 1000); // 5 hours
      expect(result).toBe('5 hours');
    });

    it('should format single hour only', () => {
      const result = formatTimeDifference(1 * 60 * 60 * 1000); // 1 hour
      expect(result).toBe('1 hour');
    });

    it('should format days only', () => {
      const result = formatTimeDifference(3 * 24 * 60 * 60 * 1000); // 3 days
      expect(result).toBe('3 days');
    });

    it('should format single day only', () => {
      const result = formatTimeDifference(1 * 24 * 60 * 60 * 1000); // 1 day
      expect(result).toBe('1 day');
    });

    it('should format days and hours', () => {
      const result = formatTimeDifference((3 * 24 + 5) * 60 * 60 * 1000); // 3 days 5 hours
      expect(result).toBe('3 days, 5 hours');
    });

    it('should format single day and single hour', () => {
      const result = formatTimeDifference((1 * 24 + 1) * 60 * 60 * 1000); // 1 day 1 hour
      expect(result).toBe('1 day, 1 hour');
    });

    it('should format days, hours, and minutes', () => {
      const result = formatTimeDifference(10963 * 60 * 1000); // 10963 minutes = 7 days, 14 hours, 43 minutes
      expect(result).toBe('7 days, 14 hours, 43 minutes');
    });

    it('should format single day, single hour, and single minute', () => {
      const result = formatTimeDifference((1 * 24 + 1) * 60 * 60 * 1000 + 1 * 60 * 1000); // 1 day, 1 hour, 1 minute
      expect(result).toBe('1 day, 1 hour, 1 minute');
    });

    it('should handle zero time difference', () => {
      const result = formatTimeDifference(0);
      expect(result).toBe('0 minutes');
    });

    it('should handle very small time differences', () => {
      const result = formatTimeDifference(30 * 1000); // 30 seconds = 0 minutes
      expect(result).toBe('0 minutes');
    });

    it('should handle large time differences', () => {
      const result = formatTimeDifference(365 * 24 * 60 * 60 * 1000); // 1 year = 365 days
      expect(result).toBe('365 days');
    });

    it('should format complex example from real usage', () => {
      // Test the exact example from the user's output
      const result = formatTimeDifference(10963 * 60 * 1000);
      expect(result).toBe('7 days, 14 hours, 43 minutes');
    });
  });
});
