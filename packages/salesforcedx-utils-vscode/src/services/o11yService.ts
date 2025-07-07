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

export class O11yService {
  O11Y_UPLOAD_THRESHOLD_BYTES = 50_000;
  o11yUploadEndpoint: string | undefined;
  instrumentation: Instrumentation;
  a4dO11ySchema: unknown;
  readonly environment: Record<string, string> = {};
  private static instances: Map<string, O11yService> = new Map();

  // Shared instrumentation and app across all extensions
  private static sharedInstrumentation: Instrumentation | null = null;
  private static sharedInstrApp: InstrumentedAppMethods | null = null;
  private static sharedO11yModules: Awaited<ReturnType<typeof loadO11yModules>> | null = null;
  private static sharedProtoEncoderFunc: ProtoEncoderFuncType | null = null;

  // Extension-specific properties
  private extensionName: string = '';

  private constructor() {}

  public static getInstance(extensionId: string): O11yService {
    if (!O11yService.instances.has(extensionId)) {
      const instance = new O11yService();
      O11yService.instances.set(extensionId, instance);
    }
    return O11yService.instances.get(extensionId)!;
  }

  async initialize(extensionName: string, o11yUploadEndpoint: string) {
    this.extensionName = extensionName;
    this.o11yUploadEndpoint = o11yUploadEndpoint;

    // Initialize shared resources if not already done
    if (!O11yService.sharedInstrApp) {
      await this.initializeSharedResources();
    }

    // Set up instance-specific references to shared resources
    this.instrumentation = O11yService.sharedInstrumentation!;
    this.a4dO11ySchema = O11yService.sharedO11yModules!.a4d_instrumentation;

    const { o11yClientVersion, o11ySchemaVersion } = O11yService.sharedO11yModules!;

    Object.assign(this.environment, {
      appName: 'salesforce-vscode-extensions', // Single shared app name
      extensionName: this.extensionName, // Extension-specific identifier
      o11ySchemaVersion,
      sdkVersion: `${o11yClientVersion}:${o11ySchemaVersion}`
    });
  }

  private async initializeSharedResources() {
    // Ensure modules are loaded before using them
    O11yService.sharedO11yModules = await loadO11yModules();

    const { o11yClientVersion, o11ySchemaVersion, getInstrumentation, registerInstrumentedApp } =
      O11yService.sharedO11yModules!;

    // Create a single shared instrumentation
    const sharedInstrumentationName = 'salesforce-vscode-extensions-instrumentation';
    O11yService.sharedInstrumentation = getInstrumentation(sharedInstrumentationName);

    // Create a single shared app
    const sharedAppName = 'salesforce-vscode-extensions';

    // STEP 1: Register the shared app
    O11yService.sharedInstrApp = registerInstrumentedApp(sharedAppName, {
      isProduction: false,
      enableBuffering: true
    });

    // STEP 2: Register a metrics collector on the shared app
    O11yService.sharedInstrApp.simpleCollector = this.initSimpleCollector(
      O11yService.sharedInstrApp,
      {
        appName: sharedAppName,
        sdkVersion: `${o11yClientVersion}:${o11ySchemaVersion}`
      },
      O11yService.sharedO11yModules
    );

    // Set up shared proto encoder
    if (O11yService.sharedO11yModules) {
      const { collectorsModule } = O11yService.sharedO11yModules;
      O11yService.sharedProtoEncoderFunc = encodeCoreEnvelopeContentsRawSchem.parse(
        collectorsModule.default || collectorsModule
      ).encodeCoreEnvelopeContentsRaw;
    }
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

  async upload(): Promise<void> {
    try {
      // Log anything that was buffered
      await this.uploadAsNeededAsync(true);
    } catch (error) {
      // We log the failure but do not throw, preventing disruptions in telemetry reporting.
      console.error('Telemetry upload failed:', error);
    }
  }

  initSimpleCollector(
    o11yApp: InstrumentedAppMethods,
    environment: Environment,
    o11yModules: Awaited<ReturnType<typeof loadO11yModules>> | null
  ): Promise<SimpleCollector> {
    if (!o11yModules) {
      throw new Error('o11yModules is null');
    }

    const { simpleCollectorModule } = o11yModules;

    const simpleCollector = new (simpleCollectorModule.default || simpleCollectorModule).SimpleCollector({
      environment
    });

    o11yApp.registerLogCollector(simpleCollector, { retroactive: true });
    o11yApp.registerMetricsCollector(simpleCollector);
    return simpleCollector;
  }

  uploadAsNeededAsync(ignoreThreshold = false): Promise<PromiseSettledResult<Response>[]> {
    const promises: Promise<Response>[] = [];

    if (!O11yService.sharedProtoEncoderFunc) {
      console.error('sharedProtoEncoderFunc is not initialized');
      return Promise.resolve([]); // Prevents the function from throwing an error
    }

    const simpleCollector = O11yService.sharedInstrApp?.simpleCollector;
    if (
      simpleCollector?.hasData &&
      (ignoreThreshold || simpleCollector.estimatedByteSize >= this.O11Y_UPLOAD_THRESHOLD_BYTES)
    ) {
      const rawContents = simpleCollector.getRawContentsOfCoreEnvelope();
      const binary = O11yService.sharedProtoEncoderFunc(rawContents);
      promises.push(this.uploadToFalconAsync(binary));
    }

    return Promise.allSettled(promises);
  }

  async uploadToFalconAsync(binary: Uint8Array): Promise<Response> {
    const b64 = Buffer.from(binary).toString('base64');

    if (!this.o11yUploadEndpoint) {
      return Promise.reject(new Error('o11yUploadEndpoint is not defined'));
    }

    return this.postRequest(this.o11yUploadEndpoint, { base64Env: b64 });
  }

  postRequest = (endpoint: string, body: any): Promise<Response> =>
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
