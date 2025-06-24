/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Disabling these ESLint rules because:
 * - `@typescript-eslint/no-unsafe-call`: The telemetry modules from `o11yModules`
 *   (e.g., `getInstrumentation`, `registerInstrumentedApp`, `ConsoleCollector`, `a4d_instrumentation`).
 *   Refactoring them would require upstream type fixes that are outside the scope of this service.
 * - `@typescript-eslint/no-unsafe-assignment`: `o11yModules` is dynamically imported via `loadO11yModules()`,
 *   and its properties (`o11yClientVersion`, `o11ySchemaVersion`, etc.) lack strict TypeScript typings.
 *   Assigning them directly triggers this rule, but they are known to be valid based on runtime behavior.
 * - `@typescript-eslint/no-unsafe-member-access`: Accessing properties on `o11yModules` (e.g., `simpleCollectorModule`,
 *   `collectorsModule`, `encodeCoreEnvelopeContentsRaw`) is flagged as unsafe because TypeScript
 *   cannot infer their structure at compile time. However, these properties are safely used
 *   within the expected API contracts of the O11y SDK.
 *
 * TODO: Revisit this once the `o11yModules` typings are improved or consider wrapping them in explicit type definitions.
 */

/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { z } from 'zod';
import { loadO11yModules } from '../telemetry/utils/o11yLoader';

const O11Y_UPLOAD_THRESHOLD_BYTES = 50_000;
export class O11yService {
  private o11yUploadEndpoint: string | undefined;
  private instrumentation: Instrumentation;
  private _instrApp: InstrumentedAppMethods;
  private protoEncoderFunc: ProtoEncoderFuncType | null = null;
  private a4dO11ySchema: unknown;
  private readonly environment: Record<string, string> = {};
  private o11yModules: Awaited<ReturnType<typeof loadO11yModules>> | null = null;
  private static instance: O11yService | null = null;

  private constructor() {}

  public static getInstance(): O11yService {
    if (!O11yService.instance) {
      const instance = new O11yService();
      O11yService.instance = instance;
    }
    return O11yService.instance;
  }

  public async initialize(extensionName: string, o11yUploadEndpoint: string) {
    this.o11yUploadEndpoint = o11yUploadEndpoint;
    // Ensure modules are loaded before using them
    this.o11yModules = await loadO11yModules();

    const { o11yClientVersion, o11ySchemaVersion, getInstrumentation, registerInstrumentedApp, a4d_instrumentation } =
      this.o11yModules!;

    this.instrumentation = getInstrumentation(extensionName + '-instrumentation');
    this.a4dO11ySchema = a4d_instrumentation;

    Object.assign(this.environment, {
      appName: extensionName + '-extension',
      o11ySchemaVersion,
      sdkVersion: `${o11yClientVersion}:${o11ySchemaVersion}`
    });

    // STEP 1: Register the app
    this._instrApp = registerInstrumentedApp(extensionName + '-extension', {
      isProduction: false,
      enableBuffering: true
    });

    // STEP 2: Register a metrics collector
    this._instrApp.simpleCollector = this.initSimpleCollector(
      this._instrApp,
      {
        appName: this.environment.appName,
        sdkVersion: this.environment.sdkVersion
      },
      this.o11yModules
    );
  }

  public logEvent(properties?: { [key: string]: any }): void {
    if (this.instrumentation) {
      this.instrumentation.log(this.a4dO11ySchema, {
        message: JSON.stringify(properties)
      });
    } else {
      console.log('O11yService: Unable to log event - Instrumentation not initialized.');
    }
  }

  public async upload(): Promise<void> {
    try {
      // Log anything that was buffered
      await this.uploadAsNeededAsync(true);
    } catch (error) {
      // We log the failure but do not throw, preventing disruptions in telemetry reporting.
      console.error('Telemetry upload failed:', error);
    }
  }

  private initSimpleCollector(
    o11yApp: InstrumentedAppMethods,
    environment: Environment,
    o11yModules: Awaited<ReturnType<typeof loadO11yModules>> | null
  ): Promise<SimpleCollector> {
    if (!o11yModules) {
      throw new Error('o11yModules is null');
    }

    const { simpleCollectorModule, collectorsModule } = o11yModules;

    this.protoEncoderFunc = encodeCoreEnvelopeContentsRawSchem.parse(
      collectorsModule.default || collectorsModule
    ).encodeCoreEnvelopeContentsRaw;

    const simpleCollector = new (simpleCollectorModule.default || simpleCollectorModule).SimpleCollector({
      environment
    });

    o11yApp.registerLogCollector(simpleCollector, { retroactive: true });
    o11yApp.registerMetricsCollector(simpleCollector);
    return simpleCollector;
  }

  private uploadAsNeededAsync(ignoreThreshold = false): Promise<PromiseSettledResult<Response>[]> {
    const promises: Promise<Response>[] = [];

    if (!this.protoEncoderFunc) {
      console.error('protoEncoderFunc is not initialized');
      return Promise.resolve([]); // Prevents the function from throwing an error
    }

    const simpleCollector = this._instrApp.simpleCollector;
    if (
      simpleCollector?.hasData &&
      (ignoreThreshold || simpleCollector.estimatedByteSize >= O11Y_UPLOAD_THRESHOLD_BYTES)
    ) {
      const rawContents = simpleCollector.getRawContentsOfCoreEnvelope();
      const binary = this.protoEncoderFunc(rawContents);
      promises.push(this.uploadToFalconAsync(binary));
    }

    return Promise.allSettled(promises);
  }

  // public only for testing
  public async uploadToFalconAsync(binary: Uint8Array): Promise<Response> {
    const b64 = Buffer.from(binary).toString('base64');

    if (!this.o11yUploadEndpoint) {
      throw new Error('o11yUploadEndpoint is not defined');
    }

    return this.postRequest(this.o11yUploadEndpoint, { base64Env: b64 });
  }

  // public only for testing
  public postRequest = (endpoint: string, body: any): Promise<Response> =>
    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).catch(error => {
      console.error('Post Request failed:', error);
      throw error;
    });
}

const encodeCoreEnvelopeContentsRawSchem = z.object({
  encodeCoreEnvelopeContentsRaw: z.function().returns(z.instanceof(Uint8Array))
});
