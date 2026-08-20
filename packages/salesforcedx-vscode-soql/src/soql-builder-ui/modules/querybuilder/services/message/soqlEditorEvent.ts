/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { JsonMap } from '@salesforce/ts-types';
import type { Field } from 'jsforce/lib/types/common';

type SObjectField = Pick<Field, 'name' | 'type' | 'nillable' | 'picklistValues'> &
  Partial<Pick<Field, 'filterable' | 'groupable' | 'label' | 'sortable'>>;

export type SObjectMetadata = {
  fields: SObjectField[];
};

export const MessageType = {
  UI_ACTIVATED: 'ui_activated',
  UI_SOQL_CHANGED: 'ui_soql_changed',
  UI_TELEMETRY: 'ui_telemetry',
  SOBJECT_METADATA_REQUEST: 'sobject_metadata_request',
  SOBJECT_METADATA_RESPONSE: 'sobject_metadata_response',
  SOBJECTS_REQUEST: 'sobjects_request',
  SOBJECTS_RESPONSE: 'sobjects_response',
  TEXT_SOQL_CHANGED: 'text_soql_changed',
  RUN_SOQL_QUERY: 'run_query',
  CONNECTION_CHANGED: 'connection_changed',
  RUN_SOQL_QUERY_DONE: 'run_query_done',
  NO_DEFAULT_ORG: 'no_default_org',
  GET_QUERY_PLAN: 'get_query_plan',
  GET_QUERY_PLAN_DONE: 'get_query_plan_done',
  SET_DEFAULT_ORG: 'set_default_org'
} as const;

export type MessageType = (typeof MessageType)[keyof typeof MessageType];

export type SoqlEditorEvent =
  | { type: 'ui_activated' }
  | { type: 'ui_soql_changed'; payload: string }
  | { type: 'ui_telemetry'; payload: JsonMap }
  | { type: 'sobject_metadata_request'; payload: string }
  | { type: 'sobject_metadata_response'; payload: SObjectMetadata }
  | { type: 'sobjects_request' }
  | { type: 'sobjects_response'; payload: string[] }
  | { type: 'text_soql_changed'; payload: string }
  | { type: 'run_query' }
  | { type: 'connection_changed' }
  | { type: 'run_query_done' }
  | { type: 'no_default_org' }
  | { type: 'get_query_plan' }
  | { type: 'get_query_plan_done' }
  | { type: 'set_default_org' };
