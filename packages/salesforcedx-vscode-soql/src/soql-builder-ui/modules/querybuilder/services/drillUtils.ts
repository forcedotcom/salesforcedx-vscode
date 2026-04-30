/*
 *  Copyright (c) 2026, salesforce.com, inc.
 *  All rights reserved.
 *  Licensed under the BSD 3-Clause license.
 *  For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 *
 *  Utilities for extracting relationship metadata from sObject describes.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export type RelOption = {
  relationshipName: string;
  referenceTo: string[];
};

export type ChildRelOption = {
  relationshipName: string;
  childSObject: string;
};

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

export const extractChildRelOptions = (metadata: any): ChildRelOption[] => {
  if (!metadata || !Array.isArray(metadata.childRelationships)) return [];
  return (metadata.childRelationships as any[])
    .filter((cr: any) => cr.relationshipName && cr.childSObject)
    .map((cr: any) => ({
      relationshipName: cr.relationshipName as string,
      childSObject: cr.childSObject as string
    }));
};
