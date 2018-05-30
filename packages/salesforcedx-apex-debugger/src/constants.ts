/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export const DEBUGGER_TYPE = 'apex';
export const LIVESHARE_DEBUGGER_TYPE = 'vslsShare';
export const DEFAULT_INITIALIZE_TIMEOUT_MS = 10000;
export const DEFAULT_STREAMING_TIMEOUT_MS = 14400;
export const DEFAULT_LOCK_TIMEOUT_MS = 10000;
export const DEFAULT_IDLE_TIMEOUT_MS = 1200000;
export const DEFAULT_IDLE_WARN1_MS = 600000;
export const DEFAULT_IDLE_WARN2_MS = 900000;
export const DEFAULT_IDLE_WARN3_MS = 1080000;
export const GET_LINE_BREAKPOINT_INFO_EVENT = 'getLineBreakpointInfo';
export const SHOW_MESSAGE_EVENT = 'showMessage';
export const GET_WORKSPACE_SETTINGS_EVENT = 'getWorkspaceSettings';
export const LINE_BREAKPOINT_INFO_REQUEST = 'lineBreakpointInfo';
export const HOTSWAP_REQUEST = 'hotswap';
export const WORKSPACE_SETTINGS_REQUEST = 'workspaceSettings';
export const EXCEPTION_BREAKPOINT_REQUEST = 'exceptionBreakpoint';
export const LIST_EXCEPTION_BREAKPOINTS_REQUEST = 'listExceptionBreakpoints';
export const LIVESHARE_DEBUG_TYPE_REQUEST = 'debugType';
export const EXCEPTION_BREAKPOINT_BREAK_MODE_ALWAYS = 'always';
export const EXCEPTION_BREAKPOINT_BREAK_MODE_NEVER = 'never';
export const SALESFORCE_EXCEPTION_PREFIX = 'com/salesforce/api/exception/';
export const TRIGGER_EXCEPTION_PREFIX = '__sfdc_trigger/';
