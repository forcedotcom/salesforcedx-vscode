/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { nls } from '../messages';

/** Common Salesforce API / connection error patterns that should be mapped to user-friendly messages */
const UNKNOWN_EXCEPTION = 'UNKNOWN_EXCEPTION';
const AUTH_PATTERNS = [
  '401',
  'Unauthorized',
  'authentication',
  'auth',
  'token',
  'session',
  'expired',
  'invalid_grant',
  'invalid session',
  'INVALID_SESSION_ID',
  'invalid_session_id'
];
const CONNECTION_NETWORK_PATTERNS = [
  'ECONNREFUSED',
  'ETIMEDOUT',
  'ENOTFOUND',
  'ENETUNREACH',
  'network',
  'getaddrinfo',
  'socket hang up',
  'connection refused',
  'timeout'
];
const ORG_RESOURCE_PATTERNS = ['requested resource does not exist', '404', 'not found'];

const getMessageFromObject = (obj: object): string | undefined => {
  const m = Object.getOwnPropertyDescriptor(obj, 'message')?.value;
  return typeof m === 'string' ? m : undefined;
};

const getRawMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object') {
    const msg = getMessageFromObject(error);
    if (msg !== undefined) {
      return msg;
    }
    // Salesforce API often returns { body: [{ errorCode, message }] }
    const body = Object.getOwnPropertyDescriptor(error, 'body')?.value;
    if (Array.isArray(body) && body.length > 0) {
      const first = body[0];
      if (first && typeof first === 'object') {
        const firstMsg = getMessageFromObject(first);
        if (firstMsg !== undefined) {
          return firstMsg;
        }
      }
    }
    if (body && typeof body === 'object' && !Array.isArray(body)) {
      const bodyMsg = getMessageFromObject(body);
      if (bodyMsg !== undefined) {
        return bodyMsg;
      }
    }
  }
  return String(error);
};

/**
 * Maps connection, auth, and API errors from Apex test operations to user-friendly messages.
 * Ensures UNKNOWN_EXCEPTION and similar generic errors are never shown raw.
 */
export const toUserFriendlyApexTestError = (error: unknown): string => {
  const raw = getRawMessage(error);
  const lower = raw.trim().toLowerCase();

  if (raw === UNKNOWN_EXCEPTION || lower === 'unknown_exception') {
    return nls.localize('apex_test_error_unknown_exception_message');
  }

  if (AUTH_PATTERNS.some(p => lower.includes(p.toLowerCase()))) {
    return nls.localize('apex_test_error_auth_message');
  }

  if (CONNECTION_NETWORK_PATTERNS.some(p => lower.includes(p.toLowerCase()))) {
    return nls.localize('apex_test_error_connection_message');
  }

  if (ORG_RESOURCE_PATTERNS.some(p => lower.includes(p.toLowerCase()))) {
    return nls.localize('apex_test_error_resource_not_found_message');
  }

  // 431 Request Header Fields Too Large is already handled in discoverTests; keep raw for other callers
  if (lower.includes('431') || lower.includes('request header fields too large')) {
    return nls.localize('apex_test_discovery_partial_warning');
  }

  // If the message is already descriptive (long enough, no raw code), use it
  if (raw.length > 50 && !lower.includes('unknown_exception')) {
    return raw;
  }

  // Generic API/org failure fallback
  if (lower.includes('api') || lower.includes('tooling') || lower.includes('server')) {
    return nls.localize('apex_test_error_api_message', raw);
  }

  return raw;
};
