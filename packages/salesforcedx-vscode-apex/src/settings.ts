/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as HashSet from 'effect/HashSet';
import { APEX_SETTINGS_SECTION } from './constants';

// Eligibility for OpenAPI Document ONLY, should not be changed by users unless overwriting in settings.json
const APEX_ACTION_CLASS_DEF_MODIFIERS = ['withsharing', 'withoutsharing', 'inheritedsharing'];
const APEX_ACTION_CLASS_ACCESS_MODIFIERS = ['global', 'public'];
const APEX_ACTION_METHOD_DEF_MODIFIERS = ['static'];
const APEX_ACTION_METHOD_ACCESS_MODIFIERS = ['global', 'public'];
const APEX_ACTION_PROP_DEF_MODIFIERS = ['static'];
const APEX_ACTION_PROP_ACCESS_MODIFIERS = ['global', 'public'];
const APEX_ACTION_CLASS_REST_ANNOTATION = ['RestResource'];
const APEX_ACTION_METHOD_REST_ANNOTATION = ['HttpDelete', 'HttpGet', 'HttpPatch', 'HttpPost', 'HttpPut'];
const APEX_ACTION_METHOD_ANNOTATION: string[] = ['AuraEnabled'];

// Default eligibility for general OAS generation. Users can changed the setting through VSCode configurations
const DEFAULT_CLASS_ACCESS_MODIFIERS = ['global', 'public'];
const DEFAULT_METHOD_ACCESS_MODIFIERS = ['global', 'public'];
const DEFAULT_PROP_ACCESS_MODIFIERS = ['global', 'public'];

const unionValues = (defaults: readonly string[], configuredValues: readonly string[]): string[] =>
  HashSet.toValues(HashSet.union(HashSet.fromIterable(defaults), HashSet.fromIterable(configuredValues)));

const getSetting = Effect.fn('apex.getSetting')(function* <T>(key: string, defaultValue: T) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  return yield* (yield* api.services.SettingsService).getValueOrElse(APEX_SETTINGS_SECTION, key, defaultValue);
});

export const retrieveEnableSyncInitJobs = Effect.fn('apex.retrieveEnableSyncInitJobs')(function* () {
  return yield* getSetting('wait-init-jobs', true);
});

const joinedList = (key: string, defaults: readonly string[], unionDefaults: boolean) =>
  getSetting<string[]>(key, unionDefaults ? [] : [...defaults]).pipe(
    Effect.map(configured => (unionDefaults ? unionValues(defaults, configured) : configured).join(','))
  );

export const apexLanguageServerSettings = Effect.fn('apex.languageServerSettings')(() =>
  Effect.all(
    {
      lspParityCapabilities: getSetting('advanced.lspParityCapabilities', true),
      enableErrorToTelemetry: getSetting('enable-apex-ls-error-to-telemetry', false),
      enableSynchronizedInitJobs: retrieveEnableSyncInitJobs(),
      apexActionClassDefModifiers: joinedList(
        'apexoas.aa.class.definition-modifiers',
        APEX_ACTION_CLASS_DEF_MODIFIERS,
        true
      ),
      apexActionClassAccessModifiers: joinedList(
        'apexoas.aa.class.access-modifiers',
        APEX_ACTION_CLASS_ACCESS_MODIFIERS,
        true
      ),
      apexActionMethodDefModifiers: joinedList(
        'apexoas.aa.method.definition-modifiers',
        APEX_ACTION_METHOD_DEF_MODIFIERS,
        true
      ),
      apexActionMethodAccessModifiers: joinedList(
        'apexoas.aa.method.access-modifiers',
        APEX_ACTION_METHOD_ACCESS_MODIFIERS,
        true
      ),
      apexActionPropDefModifiers: joinedList(
        'apexoas.aa.prop.definition-modifiers',
        APEX_ACTION_PROP_DEF_MODIFIERS,
        true
      ),
      apexActionPropAccessModifiers: joinedList(
        'apexoas.aa.prop.definition-modifiers',
        APEX_ACTION_PROP_ACCESS_MODIFIERS,
        true
      ),
      apexActionClassRestAnnotations: Effect.succeed(APEX_ACTION_CLASS_REST_ANNOTATION.join(',')),
      apexActionMethodRestAnnotations: Effect.succeed(APEX_ACTION_METHOD_REST_ANNOTATION.join(',')),
      apexActionMethodAnnotations: joinedList('apexoas.aa.method.annotations', APEX_ACTION_METHOD_ANNOTATION, true),
      apexOASClassAccessModifiers: joinedList(
        'apexoas.general.class.access-modifiers',
        DEFAULT_CLASS_ACCESS_MODIFIERS,
        false
      ),
      apexOASMethodAccessModifiers: joinedList(
        'apexoas.general.method.access-modifiers',
        DEFAULT_METHOD_ACCESS_MODIFIERS,
        false
      ),
      apexOASPropAccessModifiers: joinedList(
        'apexoas.general.prop.access-modifiers',
        DEFAULT_PROP_ACCESS_MODIFIERS,
        false
      )
    },
    { concurrency: 'unbounded' }
  )
);

export const getApexLanguageServerRestartBehavior = Effect.fn('apex.getApexLanguageServerRestartBehavior')(
  function* () {
    return yield* getSetting('languageServer.restartBehavior', 'prompt');
  }
);
