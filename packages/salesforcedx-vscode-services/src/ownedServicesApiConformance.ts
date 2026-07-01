/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
// Compile-time conformance guard (enforced by `npm run compile` / the pre-commit hook — real tsc, NOT ts-jest,
// since the repo's ts-jest runs with isolatedModules and does not reliably evaluate these type-level checks).
//
// The hand-authored, import-free `OwnedServicesApi` (the published data-only surface) must stay a faithful
// SUBSET of the real `PlainServicesApi`. The assignment below compiles ONLY IF the real plain API is assignable
// to the owned subset on the GUARDED members; if a guarded owned member's signature drifts from the contract,
// `tsc` fails here. This is the @types/vscode technique's required guard so the hand-authored type cannot lie.
//
// Two members are intentionally EXCLUDED (documented divergences, not drift):
//   - withDefaultOrg: PromisifiedContract collapses its generic to `Promise<unknown>`; the owned type keeps the
//     more useful `<R>(use) => Promise<R>` for consumers (who would otherwise cast every result).
//   - createFromTemplateOwned: the owned `OwnedCreateParams.templateType` is `string` (import-free) where the
//     real API requires the SDK's `TemplateType` literal union; the owned param is deliberately wider so the
//     published surface needs no `@salesforce/templates` import. Runtime still validates the template name.
// Both excluded members are asserted to merely EXIST on the real API via the indexed-access parameter types.
import type { OwnedServicesApi } from './owned/ownedServicesApi';
import type { PlainServicesApi } from './plainApi';

type Excluded = 'withDefaultOrg' | 'createFromTemplateOwned';

/** Never called; exists only so `tsc` enforces the conformance assignment in its return position. */
export const assertOwnedServicesApiConformance = (
  real: Omit<PlainServicesApi, Excluded>,
  _withDefaultOrgStillExists: PlainServicesApi['withDefaultOrg'],
  _createFromTemplateOwnedStillExists: PlainServicesApi['createFromTemplateOwned']
): Omit<OwnedServicesApi, Excluded> => real;
