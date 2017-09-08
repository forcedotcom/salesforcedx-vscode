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
 */
export interface DebuggerResponse {
  referencesResponse: ReferencesResponse;
  frameResponse: FrameResponse;
  stateResponse: StateResponse;
}

export interface ReferencesResponse {
  references: References;
}

export interface FrameResponse {
  frame: Frame;
}

export interface StateResponse {
  state: State;
}

export interface References {
  references: Reference[];
}

export interface ReferenceEnum {
  OBJECT: string;
  LIST: string;
  SET: string;
  MAP: string;
}

export interface Reference {
  type: ReferenceEnum;
  id: number;
  typeRef: string;
  nameForMessages: string;
  fields?: Field[];
  size?: number;
  offset?: number;
  value?: Value[];
  tuple?: Tuple[];
}

export interface Value {
  name: string;
  declaredTypeRef: string;
  nameForMessages: string;
  ref?: number;
  value?: string;
}

export interface Field extends Value {
  index: number;
}

export interface Tuple {
  key: Value;
  value: Value;
}

export interface Frame {
  locals: Locals;
  statics: Statics;
  globals: Globals;
  stackFrame: StackFrame;
  references?: References;
}

export interface Locals {
  frameNumber: number;
  local: LocalValue[];
}

export interface LocalValue extends Value {
  slot: number;
}

export interface Statics {
  typeRef: string;
  static: Value[];
}

export interface Globals {
  global: Value[];
}

export interface StackFrame {
  typeRef: string;
  fullName: string;
  lineNumber: number;
  frameNumber: number;
}

export interface State {
  locals: Locals;
  statics: Statics;
  globals: Globals;
  stack: Stack;
  references?: References;
}

export interface Stack {
  stackFrame: StackFrame[];
}

export interface DebuggerRequest {
  getReferencesRequest: GetReferenceRequest;
}

export interface GetReferenceRequest {
  reference: ReferenceRequest[];
}

export interface ReferenceRequest {
  reference: number;
  offset?: number;
}
