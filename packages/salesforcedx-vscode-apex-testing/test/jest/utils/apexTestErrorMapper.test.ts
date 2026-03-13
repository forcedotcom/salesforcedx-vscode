/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { nls } from '../../../src/messages';
import { toUserFriendlyApexTestError } from '../../../src/utils/apexTestErrorMapper';

describe('toUserFriendlyApexTestError', () => {
  it('should map UNKNOWN_EXCEPTION to user-friendly message', () => {
    expect(toUserFriendlyApexTestError(new Error('UNKNOWN_EXCEPTION'))).toBe(
      nls.localize('apex_test_error_unknown_exception_message')
    );
  });

  it('should map auth-related errors to user-friendly message', () => {
    expect(toUserFriendlyApexTestError(new Error('401 Unauthorized'))).toBe(
      nls.localize('apex_test_error_auth_message')
    );
  });

  it('should map connection/network errors to user-friendly message', () => {
    expect(toUserFriendlyApexTestError(new Error('ECONNREFUSED'))).toBe(
      nls.localize('apex_test_error_connection_message')
    );
  });

  it('should map resource not found to user-friendly message', () => {
    expect(toUserFriendlyApexTestError(new Error('The requested resource does not exist'))).toBe(
      nls.localize('apex_test_error_resource_not_found_message')
    );
  });

  it('should return descriptive message unchanged when long enough', () => {
    const longMessage = 'A very long and descriptive error message that explains what went wrong in detail.';
    expect(toUserFriendlyApexTestError(new Error(longMessage))).toBe(longMessage);
  });

  it('should extract message from error-like object with body array', () => {
    const apiError = {
      body: [{ message: 'UNKNOWN_EXCEPTION', errorCode: 'UNKNOWN_EXCEPTION' }]
    };
    expect(toUserFriendlyApexTestError(apiError)).toBe(nls.localize('apex_test_error_unknown_exception_message'));
  });

  it('should handle string errors', () => {
    expect(toUserFriendlyApexTestError('UNKNOWN_EXCEPTION')).toBe(
      nls.localize('apex_test_error_unknown_exception_message')
    );
  });
});
