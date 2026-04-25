/*
 *  Copyright (c) 2026, salesforce.com, inc.
 *  All rights reserved.
 *  Licensed under the BSD 3-Clause license.
 *  For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 *
 *  Shared utilities for relationship drill-down navigation used by Fields,
 *  OrderBy, and WhereModifierGroup components.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export const REL_PREFIX = '→ ';
export const SUB_PREFIX = '← ';
export const MAX_DRILL_DEPTH = 5;

export type DrillLevel = {
  relationshipName: string;
  referenceTo?: string[];
  metadata: any;
};

export type RelOption = {
  relationshipName: string;
  referenceTo: string[];
};

export type ChildRelOption = {
  relationshipName: string;
  childSObject: string;
};

/** Build the flat field + → ref entries for a drilled-in sObject level. */
export const buildDrilledOptions = (metadata: any, stackDepth: number): string[] => {
  if (!metadata || !Array.isArray(metadata.fields)) return [];
  const plain: string[] = (metadata.fields as any[])
    .filter((f: any) => f.type !== 'reference' || !f.relationshipName)
    .map((f: any) => f.name as string)
    .sort();
  const refs: string[] = stackDepth < MAX_DRILL_DEPTH
    ? (metadata.fields as any[])
      .filter((f: any) => f.type === 'reference' && f.relationshipName)
      .map((f: any) => `${REL_PREFIX}${f.relationshipName as string}`)
      .sort((a, b) => a.localeCompare(b))
    : [];
  return [...plain, ...refs];
};

/** Attach metadata to the top of a drill stack, returning the new stack. */
export const applyDrillMetadata = (stack: DrillLevel[], metadata: any): DrillLevel[] => {
  if (stack.length === 0) return stack;
  return stack.map((level, i) =>
    i === stack.length - 1 ? { ...level, metadata } : level
  );
};

/** Build the breadcrumb string from a drill stack. */
export const buildBreadcrumb = (stack: DrillLevel[]): string =>
  stack.map(l => `${REL_PREFIX}${l.relationshipName}`).join(' ');

/** Build the full dotted field path from a drill stack + selected field name. */
export const buildQualifiedFieldName = (stack: DrillLevel[], fieldName: string): string => {
  const prefix = stack.map(l => l.relationshipName).join('.');
  return prefix ? `${prefix}.${fieldName}` : fieldName;
};

/** Pop the top level off a drill stack. Returns the new stack. */
export const popDrillStack = (stack: DrillLevel[]): DrillLevel[] =>
  stack.slice(0, -1);

/** Extract parent relationship fields (reference fields) from sObject metadata. */
export const extractRelOptions = (metadata: any): RelOption[] => {
  if (!metadata || !Array.isArray(metadata.fields)) return [];
  return (metadata.fields as any[])
    .filter((f: any) =>
      f.type === 'reference' &&
      f.relationshipName &&
      Array.isArray(f.referenceTo) &&
      f.referenceTo.length > 0
    )
    .map((f: any) => ({
      relationshipName: f.relationshipName as string,
      referenceTo: f.referenceTo as string[]
    }));
};

/** Extract child relationship options from sObject metadata. */
export const extractChildRelOptions = (metadata: any): ChildRelOption[] => {
  if (!metadata || !Array.isArray(metadata.childRelationships)) return [];
  return (metadata.childRelationships as any[])
    .filter((cr: any) => cr.relationshipName && cr.childSObject)
    .map((cr: any) => ({
      relationshipName: cr.relationshipName as string,
      childSObject: cr.childSObject as string
    }));
};

/** Find the referenceTo array for a relationship name in sObject metadata. */
export const findReferenceTo = (metadata: any, relationshipName: string): string[] | null => {
  if (!metadata || !Array.isArray(metadata.fields)) return null;
  const field = (metadata.fields as any[]).find(
    (f: any) => f.relationshipName === relationshipName
  );
  return field?.referenceTo ?? null;
};
