/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { OasMethodContext, OasSourceAnalysis } from './apexSourceMetadata';

const HTTP_ANNOTATIONS = new Set(['HttpGet', 'HttpPost', 'HttpPut', 'HttpPatch', 'HttpDelete']);

export type OasQualification =
  | { readonly framework: 'aura'; readonly methods: readonly OasMethodContext[] }
  | { readonly framework: 'restUnsupported' }
  | { readonly framework: 'mixed' }
  | { readonly framework: 'invalid'; readonly reason: OasIneligibilityReason };

type OasIneligibilityReason = 'classAnnotationsBlockAura' | 'noEligibleMethods';

/** Classifies OAS framework eligibility from OAS-owned parser-anchored source metadata. */
export const qualifyOasAnalysis = (analysis: OasSourceAnalysis): OasQualification => {
  const auraMethods = eligibleAuraMethods(analysis.methods);
  const hasRestResource = hasAnnotation(analysis.classContext.annotations, 'RestResource');
  const hasRestIndicators = hasRestResource || analysis.methods.some(method => hasHttpAnnotation(method));

  if (hasRestIndicators && auraMethods.length > 0) return { framework: 'mixed' };
  if (hasRestIndicators) return { framework: 'restUnsupported' };
  if (analysis.classContext.annotations.length === 0 && auraMethods.length > 0)
    return { framework: 'aura', methods: auraMethods };
  if (analysis.classContext.annotations.length > 0 && auraMethods.length > 0) {
    return { framework: 'invalid', reason: 'classAnnotationsBlockAura' };
  }
  return { framework: 'invalid', reason: 'noEligibleMethods' };
};

const eligibleAuraMethods = (methods: readonly OasMethodContext[]) =>
  methods.filter(
    method =>
      !method.modifiers.isConstructor && method.annotations.some(annotation => annotation.name === 'AuraEnabled')
  );

const hasAnnotation = (annotations: OasSourceAnalysis['classContext']['annotations'], name: string) =>
  annotations.some(annotation => annotation.name === name);

const hasHttpAnnotation = (method: OasMethodContext) =>
  method.annotations.some(annotation => HTTP_ANNOTATIONS.has(annotation.name));
