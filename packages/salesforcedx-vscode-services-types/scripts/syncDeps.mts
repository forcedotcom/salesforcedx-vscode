/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Schema from 'effect-v3/Schema';
// eslint-disable-next-line no-restricted-imports -- Node-only manifest build; VS Code APIs are unavailable.
import * as fs from 'node:fs';
import * as path from 'node:path';

const PackageJsonSchema = Schema.Record({ key: Schema.String, value: Schema.Unknown });
const parsePackageJson = Schema.decodeUnknownSync(Schema.parseJson(PackageJsonSchema));
const packageVersion = Schema.decodeUnknownSync(Schema.Struct({ version: Schema.String }));

/** Syncs the release version; legacy declaration dependencies remain pinned. */
const parentPkgPath = path.join(import.meta.dirname, '..', '..', 'salesforcedx-vscode-services', 'package.json');
const typesPkgPath = path.join(import.meta.dirname, '..', 'package.json');

const parentPkg = parsePackageJson(fs.readFileSync(parentPkgPath, 'utf8'));
const typesPkg = parsePackageJson(fs.readFileSync(typesPkgPath, 'utf8'));
const updatedTypesPkg = {
  ...typesPkg,
  version: packageVersion(parentPkg).version
};

const temporaryTypesPkgPath = `${typesPkgPath}.${process.pid}.tmp`;
fs.writeFileSync(temporaryTypesPkgPath, `${JSON.stringify(updatedTypesPkg, null, 2)}\n`, 'utf8');
fs.renameSync(temporaryTypesPkgPath, typesPkgPath);
console.log('Synced release version; preserved frozen legacy dependencies');
