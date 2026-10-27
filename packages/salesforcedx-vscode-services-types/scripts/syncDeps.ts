/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Schema from 'effect/Schema';
// eslint-disable-next-line no-restricted-imports -- Node-only manifest build; VS Code APIs are unavailable.
import * as fs from 'node:fs';
import * as path from 'node:path';

const DependencyVersions = Schema.Record({ key: Schema.String, value: Schema.String });
const PackageJsonSchema = Schema.Struct({
  name: Schema.optional(Schema.String),
  version: Schema.optional(Schema.String),
  dependencies: Schema.optional(DependencyVersions),
  devDependencies: Schema.optional(DependencyVersions),
  engines: Schema.optional(
    Schema.Struct({ vscode: Schema.optional(Schema.String), node: Schema.optional(Schema.String) })
  )
});
const parsePackageJson = Schema.decodeUnknownSync(Schema.parseJson(PackageJsonSchema), {
  onExcessProperty: 'preserve'
});

/** Syncs dependency versions from parent package to types package */
const syncDeps = (): void => {
  const parentPkgPath = path.join(__dirname, '..', '..', 'salesforcedx-vscode-services', 'package.json');
  const typesPkgPath = path.join(__dirname, '..', 'package.json');

  const parentPkg = parsePackageJson(fs.readFileSync(parentPkgPath, 'utf8'));
  const typesPkg = parsePackageJson(fs.readFileSync(typesPkgPath, 'utf8'));

  // Dependencies to sync (these are needed for type resolution)
  const depsToSync = [
    '@azure/monitor-opentelemetry-exporter',
    '@jsforce/jsforce-node',
    '@opentelemetry/api',
    '@opentelemetry/core',
    '@opentelemetry/exporter-trace-otlp-http',
    '@opentelemetry/sdk-logs',
    '@opentelemetry/sdk-metrics',
    '@opentelemetry/sdk-trace-base',
    '@opentelemetry/sdk-trace-node',
    '@opentelemetry/sdk-trace-web',
    '@salesforce/core',
    '@salesforce/source-deploy-retrieve',
    '@salesforce/source-tracking',
    '@salesforce/templates',
    'jsforce',
    'vscode-uri'
  ];

  const parentDependencies = Object.fromEntries(
    depsToSync.flatMap(dep => {
      const version = parentPkg.dependencies?.[dep];
      return version === undefined ? [] : [[dep, version]];
    })
  );
  const vscodeVersion = parentPkg.engines?.vscode;
  const updatedPackage = {
    ...typesPkg,
    version: parentPkg.version,
    dependencies: {
      ...typesPkg.dependencies,
      ...parentDependencies,
      // Freeze the consumer protocol independently of the future V4 implementation.
      effect: '3.21.2',
      '@effect/platform': '0.96.1',
      '@effect/opentelemetry': '0.63.0',
      ...(vscodeVersion === undefined ? {} : { '@types/vscode': `^${vscodeVersion.replace('^', '')}` })
    }
  };

  const temporaryTypesPkgPath = `${typesPkgPath}.${process.pid}.tmp`;
  fs.writeFileSync(temporaryTypesPkgPath, `${JSON.stringify(updatedPackage, null, 2)}\n`, 'utf8');
  fs.renameSync(temporaryTypesPkgPath, typesPkgPath);
  console.log('Synced dependencies and version from parent package');
};

syncDeps();
