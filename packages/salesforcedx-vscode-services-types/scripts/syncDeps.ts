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

const DependencyVersions = Schema.Record({ key: Schema.String, value: Schema.String }).pipe(Schema.mutable);
const PackageJsonSchema = Schema.Struct({
  name: Schema.optional(Schema.String),
  version: Schema.optional(Schema.String),
  dependencies: Schema.optional(DependencyVersions),
  devDependencies: Schema.optional(DependencyVersions),
  engines: Schema.optional(
    Schema.Struct({ vscode: Schema.optional(Schema.String), node: Schema.optional(Schema.String) })
  )
}).pipe(Schema.mutable);
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

  // Sync versions
  typesPkg.dependencies = typesPkg.dependencies ?? {};
  depsToSync.forEach(dep => {
    if (parentPkg.dependencies?.[dep]) {
      typesPkg.dependencies![dep] = parentPkg.dependencies[dep];
    }
  });

  // Frozen consumer protocol: parent implementation will move to V4 independently.
  // Ranges can install a second V3 minor with incompatible declaration identities.
  typesPkg.dependencies.effect = '3.21.2';
  typesPkg.dependencies['@effect/platform'] = '0.96.1';
  typesPkg.dependencies['@effect/opentelemetry'] = '0.63.0';

  // Add @types/vscode from parent's engines
  if (parentPkg.engines?.vscode) {
    const vscodeVersion = parentPkg.engines.vscode.replace('^', '');
    typesPkg.dependencies['@types/vscode'] = `^${vscodeVersion}`;
  }

  // Sync version number
  typesPkg.version = parentPkg.version;

  const temporaryTypesPkgPath = `${typesPkgPath}.${process.pid}.tmp`;
  fs.writeFileSync(temporaryTypesPkgPath, `${JSON.stringify(typesPkg, null, 2)}\n`, 'utf8');
  fs.renameSync(temporaryTypesPkgPath, typesPkgPath);
  console.log('Synced dependencies and version from parent package');
};

syncDeps();
