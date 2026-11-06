/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { OasMethodContext, OasSourceAnalysis } from './apexSourceMetadata';

export type OasQualification =
  | { readonly framework: 'aura'; readonly methods: readonly OasMethodContext[] }
  | { readonly framework: 'invalid'; readonly reason: 'noEligibleMethods' };

/** Classifies OAS framework eligibility from OAS-owned parser-anchored source metadata. */
export const qualifyOasAnalysis = (analysis: OasSourceAnalysis): OasQualification => {
  const auraMethods = eligibleAuraMethods(analysis.methods);

  if (auraMethods.length > 0) return { framework: 'aura', methods: auraMethods };
  return { framework: 'invalid', reason: 'noEligibleMethods' };
};

const eligibleAuraMethods = (methods: readonly OasMethodContext[]) =>
  methods.filter(
    method =>
      !method.modifiers.isConstructor && method.annotations.some(annotation => annotation.name === 'AuraEnabled')
  );
