/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Messages } from '../messages/messages';

export interface UnmodeledSyntaxReason {
  reasonCode: string;
  message: string;
}

export const REASON_UNMODELED_AS: UnmodeledSyntaxReason = {
  reasonCode: 'unmodeled:as',
  message: Messages.unmodeled_as,
};
export const REASON_UNMODELED_USING: UnmodeledSyntaxReason = {
  reasonCode: 'unmodeled:using',
  message: Messages.unmodeled_using,
};
export const REASON_UNMODELED_ALIAS: UnmodeledSyntaxReason = {
  reasonCode: 'unmodeled:alias',
  message: Messages.unmodeled_alias,
};
export const REASON_UNMODELED_SEMIJOIN: UnmodeledSyntaxReason = {
  reasonCode: 'unmodeled:semi-join',
  message: Messages.unmodeled_semijoin,
};
export const REASON_UNMODELED_TYPEOF: UnmodeledSyntaxReason = {
  reasonCode: 'unmodeled:type-of',
  message: Messages.unmodeled_typeof,
};
export const REASON_UNMODELED_DISTANCE: UnmodeledSyntaxReason = {
  reasonCode: 'unmodeled:distance',
  message: Messages.unmodeled_distance,
};
export const REASON_UNMODELED_SELECT: UnmodeledSyntaxReason = {
  reasonCode: 'unmodeled:select',
  message: Messages.unmodeled_select,
};
export const REASON_UNMODELED_COMPLEXGROUP: UnmodeledSyntaxReason = {
  reasonCode: 'unmodeled:complex-group',
  message: Messages.unmodeled_complexgroup,
};
export const REASON_UNMODELED_COUNT: UnmodeledSyntaxReason = {
  reasonCode: 'unmodeled:count',
  message: Messages.unmodeled_count,
};
export const REASON_UNMODELED_WITH: UnmodeledSyntaxReason = {
  reasonCode: 'unmodeled:with',
  message: Messages.unmodeled_with,
};
export const REASON_UNMODELED_GROUPBY: UnmodeledSyntaxReason = {
  reasonCode: 'unmodeled:group-by',
  message: Messages.unmodeled_groupby,
};
export const REASON_UNMODELED_OFFSET: UnmodeledSyntaxReason = {
  reasonCode: 'unmodeled:offset',
  message: Messages.unmodeled_offset,
};
export const REASON_UNMODELED_BIND: UnmodeledSyntaxReason = {
  reasonCode: 'unmodeled:bind',
  message: Messages.unmodeled_bind,
};
export const REASON_UNMODELED_RECORDTRACKING: UnmodeledSyntaxReason = {
  reasonCode: 'unmodeled:record-tracking',
  message: Messages.unmodeled_recordtracking,
};
export const REASON_UNMODELED_UPDATE: UnmodeledSyntaxReason = {
  reasonCode: 'unmodeled:update',
  message: Messages.unmodeled_update,
};
export const REASON_UNMODELED_FUNCTIONREFERENCE: UnmodeledSyntaxReason = {
  reasonCode: 'unmodeled:function-reference',
  message: Messages.unmodeled_functionreference,
};
export const REASON_UNMODELED_COLONEXPRESSION: UnmodeledSyntaxReason = {
  reasonCode: 'unmodeled:colon-expression',
  message: Messages.unmodeled_colonexpression,
};
export const REASON_UNMODELED_EMPTYCONDITION: UnmodeledSyntaxReason = {
  reasonCode: 'unmodeled:empty-condition',
  message: Messages.unmodeled_emptycondition,
};
export const REASON_UNMODELED_CALCULATEDCONDITION: UnmodeledSyntaxReason = {
  reasonCode: 'unmodeled:calculated-condition',
  message: Messages.unmodeled_calculatedcondition,
};
export const REASON_UNMODELED_DISTANCECONDITION: UnmodeledSyntaxReason = {
  reasonCode: 'unmodeled:distance-condition',
  message: Messages.unmodeled_distancecondition,
};
export const REASON_UNMODELED_INCOLONEXPRESSIONCONDITION: UnmodeledSyntaxReason = {
  reasonCode: 'unmodeled:in-colon-expression-condition',
  message: Messages.unmodeled_incolonexpressioncondition,
};
export const REASON_UNMODELED_INSEMIJOINCONDITION: UnmodeledSyntaxReason = {
  reasonCode: 'unmodeled:in-semi-join-condition',
  message: Messages.unmodeled_insemijoincondition,
};
