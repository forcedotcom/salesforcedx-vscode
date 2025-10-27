import * as fs from 'fs';
import * as path from 'path';

type PackageJson = {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  engines?: {
    vscode?: string;
    node?: string;
  };
};

/** Syncs dependency versions from parent package to types package */
const syncDeps = (): void => {
  const parentPkgPath = path.join(__dirname, '..', '..', 'salesforcedx-vscode-services', 'package.json');
  const typesPkgPath = path.join(__dirname, '..', 'package.json');

  const parentPkg: PackageJson = JSON.parse(fs.readFileSync(parentPkgPath, 'utf8'));
  const typesPkg: PackageJson = JSON.parse(fs.readFileSync(typesPkgPath, 'utf8'));

  // Dependencies to sync (these are needed for type resolution)
  const depsToSync = [
    '@azure/monitor-opentelemetry-exporter',
    '@effect/opentelemetry',
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
    'effect',
    'jsforce',
    'vscode-uri'
  ];

  // Sync versions
  typesPkg.dependencies = typesPkg.dependencies || {};
  depsToSync.forEach(dep => {
    if (parentPkg.dependencies?.[dep]) {
      typesPkg.dependencies![dep] = parentPkg.dependencies[dep];
    }
  });

  // Add @types/vscode from parent's engines
  if (parentPkg.engines?.vscode) {
    const vscodeVersion = parentPkg.engines.vscode.replace('^', '');
    typesPkg.dependencies['@types/vscode'] = `^${vscodeVersion}`;
  }

  // Sync version number
  typesPkg.version = parentPkg.version;

  fs.writeFileSync(typesPkgPath, JSON.stringify(typesPkg, null, 2) + '\n', 'utf8');
  console.log('Synced dependencies and version from parent package');
};

syncDeps();
