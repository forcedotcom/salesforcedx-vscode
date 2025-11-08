/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/** Get connection status from error */
export const getConnectionStatusFromError = (err: any, username?: string): string => {
  const message = err instanceof Error ? err.message : String(err);
  const lowerMsg = message.toLowerCase();

  if (lowerMsg.includes('maintenance')) return 'Down (Maintenance)';
  if (lowerMsg.includes('<html>') || lowerMsg.includes('<!doctype html>')) return 'Bad Response';
  if (
    ['expired access/refresh token', 'invalid_session_id', 'bad_oauth_token', 'refreshtokenautherror'].some(token =>
      lowerMsg.includes(token)
    )
  ) {
    return 'Unable to refresh session: expired access/refresh token';
  }
  if (shouldRemoveOrg(err)) {
    return username ? `Invalid org: ${username}` : 'Invalid org';
  }

  return message;
};

/** Check if org should be removed based on error */
export const shouldRemoveOrg = (err: any): boolean => {
  const lowerMsg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return ['invalid_login', 'no such org', 'namedorgnotfound', 'noauthinfofound'].some(msg => lowerMsg.includes(msg));
};
