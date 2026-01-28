/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { messages } from '../messages/i18n';

export interface UnmodeledSyntaxReason {
  reasonCode: string;
  message: string;
}

export const REASON_UNMODELED_AS: UnmodeledSyntaxReason = {
  reasonCode: 'unmodeled:as',
  message: messages.unmodeled_as,
};
export const REASON_UNMODELED_USING: UnmodeledSyntaxReason = {
  reasonCode: 'unmodeled:using',
  message: messages.unmodeled_using,
};
export const REASON_UNMODELED_ALIAS: UnmodeledSyntaxReason = {
  reasonCode: 'unmodeled:alias',
  message: messages.unmodeled_alias,
};
export const REASON_UNMODELED_SEMIJOIN: UnmodeledSyntaxReason = {
  reasonCode: 'unmodeled:semi-join',
  message: messages.unmodeled_semijoin,
};
export const REASON_UNMODELED_TYPEOF: UnmodeledSyntaxReason = {
  reasonCode: 'unmodeled:type-of',
  message: messages.unmodeled_typeof,
};
export const REASON_UNMODELED_DISTANCE: UnmodeledSyntaxReason = {
  reasonCode: 'unmodeled:distance',
  message: messages.unmodeled_distance,
};
export const REASON_UNMODELED_SELECT: UnmodeledSyntaxReason = {
  reasonCode: 'unmodeled:select',
  message: messages.unmodeled_select,
};
export const REASON_UNMODELED_COMPLEXGROUP: UnmodeledSyntaxReason = {
  reasonCode: 'unmodeled:complex-group',
  message: messages.unmodeled_complexgroup,
};
export const REASON_UNMODELED_WITH: UnmodeledSyntaxReason = {
  reasonCode: 'unmodeled:with',
  message: messages.unmodeled_with,
};
export const REASON_UNMODELED_GROUPBY: UnmodeledSyntaxReason = {
  reasonCode: 'unmodeled:group-by',
  message: messages.unmodeled_groupby,
};
export const REASON_UNMODELED_OFFSET: UnmodeledSyntaxReason = {
  reasonCode: 'unmodeled:offset',
  message: messages.unmodeled_offset,
};
export const REASON_UNMODELED_BIND: UnmodeledSyntaxReason = {
  reasonCode: 'unmodeled:bind',
  message: messages.unmodeled_bind,
};
export const REASON_UNMODELED_RECORDTRACKING: UnmodeledSyntaxReason = {
  reasonCode: 'unmodeled:record-tracking',
  message: messages.unmodeled_recordtracking,
};
export const REASON_UNMODELED_UPDATE: UnmodeledSyntaxReason = {
  reasonCode: 'unmodeled:update',
  message: messages.unmodeled_update,
};
export const REASON_UNMODELED_FUNCTIONREFERENCE: UnmodeledSyntaxReason = {
  reasonCode: 'unmodeled:function-reference',
  message: messages.unmodeled_functionreference,
};
export const REASON_UNMODELED_COLONEXPRESSION: UnmodeledSyntaxReason = {
  reasonCode: 'unmodeled:colon-expression',
  message: messages.unmodeled_colonexpression,
};
export const REASON_UNMODELED_EMPTYCONDITION: UnmodeledSyntaxReason = {
  reasonCode: 'unmodeled:empty-condition',
  message: messages.unmodeled_emptycondition,
};
export const REASON_UNMODELED_CALCULATEDCONDITION: UnmodeledSyntaxReason = {
  reasonCode: 'unmodeled:calculated-condition',
  message: messages.unmodeled_calculatedcondition,
};
export const REASON_UNMODELED_DISTANCECONDITION: UnmodeledSyntaxReason = {
  reasonCode: 'unmodeled:distance-condition',
  message: messages.unmodeled_distancecondition,
};
export const REASON_UNMODELED_INCOLONEXPRESSIONCONDITION: UnmodeledSyntaxReason = {
  reasonCode: 'unmodeled:in-colon-expression-condition',
  message: messages.unmodeled_incolonexpressioncondition,
};
export const REASON_UNMODELED_INSEMIJOINCONDITION: UnmodeledSyntaxReason = {
  reasonCode: 'unmodeled:in-semi-join-condition',
  message: messages.unmodeled_insemijoincondition,
};
