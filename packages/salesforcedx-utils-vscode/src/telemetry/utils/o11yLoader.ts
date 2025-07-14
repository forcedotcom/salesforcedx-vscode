/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */

let cachedModules: Promise<{
  o11yClientVersion: string;
  getInstrumentation: (name?: string) => Instrumentation;
  o11ySchemaVersion: string;
  registerInstrumentedApp: (name: string, options?: InstrumentedAppOptions) => InstrumentedAppMethods;
  ConsoleCollector: ConsoleCollector;
  a4d_instrumentation: unknown;
  simpleCollectorModule: any;
  collectorsModule: any;
}> | null = null;

export const loadO11yModules = async (): Promise<Awaited<typeof cachedModules>> => {
  cachedModules ??= (async () => {
    const [o11yClient, o11ySchema, a4dInstrumentationModule, simpleCollectorModule, collectorsModule] =
      await Promise.all([
        import('o11y/client'),
        import('o11y_schema/version'),
        import('o11y_schema/sf_a4dInstrumentation'),
        import('o11y/simple_collector'),
        import('o11y/collectors')
      ]);

    const { registerInstrumentedApp, ConsoleCollector, _version: o11yClientVersion, getInstrumentation } = o11yClient;
    const { version: o11ySchemaVersion } = o11ySchema;

    return {
      o11yClientVersion,
      getInstrumentation,
      o11ySchemaVersion,
      registerInstrumentedApp,
      ConsoleCollector,
      a4d_instrumentation: a4dInstrumentationModule.a4dInstrumentationSchema,
      simpleCollectorModule,
      collectorsModule
    };
  })();
  return cachedModules;
};
