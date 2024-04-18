/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * These interfaces were generated with the following semi-automated steps:
 * 1. Gather sample JSON responses from Apex Debugger APIs.
 * 2. Input those responses into {@link http://json2ts.com/} to generate Typescript interfaces.
 * 3. Remove duplicate interfaces that are used in more than one response object.
 * 4. Fixed bogus generated interface ReferenceEnum
 *
 * NOTE: These interfaces were converted to types during the Core v6 -> v7 upgrade to conform to new standards.
 */
export type DebuggerResponse = {
  referencesResponse: ReferencesResponse;
  frameResponse: FrameResponse;
  stateResponse: StateResponse;
};

export type ReferencesResponse = {
  references: References;
};

export type FrameResponse = {
  frame: Frame;
};

export type StateResponse = {
  state: State;
};

export type References = {
  references: Reference[];
};

export type Reference = {
  type: string;
  id: number;
  typeRef: string;
  nameForMessages: string;
  fields?: Field[];
  size?: number;
  offset?: number;
  value?: Value[];
  tuple?: Tuple[];
};

export type Value = {
  name: string;
  declaredTypeRef: string;
  nameForMessages: string;
  ref?: number;
  value?: string;
};

export type Field = Value & {
  index: number;
};

export type Tuple = {
  key: Value;
  value: Value;
};

export type Frame = {
  locals: Locals;
  statics: Statics;
  globals: Globals;
  stackFrame: StackFrame;
  references?: References;
};

export type Locals = {
  frameNumber: number;
  local: LocalValue[];
};

export type LocalValue = Value & {
  slot: number;
};

export type Statics = {
  typeRef: string;
  static: Value[];
};

export type Globals = {
  global: Value[];
};

export type StackFrame = {
  typeRef: string;
  fullName: string;
  lineNumber: number;
  frameNumber: number;
};

export type State = {
  locals: Locals;
  statics: Statics;
  globals: Globals;
  stack: Stack;
  references?: References;
};

export type Stack = {
  stackFrame: StackFrame[];
};

export type DebuggerRequest = {
  getReferencesRequest: GetReferenceRequest;
};

export type GetReferenceRequest = {
  reference: ReferenceRequest[];
};

export type ReferenceRequest = {
  reference: number;
  offset?: number;
};
