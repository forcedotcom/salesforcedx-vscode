/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// This is Node.js test infrastructure, not extension code
import { resolveCliPathFromVSCodeExecutablePath } from '@vscode/test-electron';
import { spawnSync } from 'node:child_process';
import * as crypto from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

type ExtensionPackageJson = {
  name: string;
  publisher: string;
  version: string;
  extensionDependencies?: string[];
};

type InstalledExtension = {
  identifier?: { id?: string };
  version?: string;
  location?: { path?: string; fsPath?: string };
  relativeLocation?: string;
  metadata?: { source?: string };
};

export type PrepareVsixExtensionsOptions = {
  repoRoot: string;
  packageDirs: string[];
  vscodeExecutable: string;
  marketplaceExtensions?: string[];
};

export type PreparedVsixExtension = {
  directory: string;
  id: string;
  version: string;
  vsixPath: string;
  sha256: string;
};

export type PreparedVsixExtensions = {
  extensionsDir: string;
  extensions: PreparedVsixExtension[];
};

type LocalVsixExtension = Omit<PreparedVsixExtension, 'directory'> & { packageDir: string };

type ProvenanceManifest = {
  marketplaceExtensions: string[];
  extensions: LocalVsixExtension[];
};

const DIAGNOSTIC_LIMIT = 4000;
const LOCK_RETRY_MS = 50;
const LOCK_STALE_MS = 5 * 60_000;
const LOCK_TIMEOUT_MS = 30_000;
const LOCK_OWNER_FILE = 'owner.json';
const PROVENANCE_FILE = '.vsix-provenance.json';

const unique = <T>(values: T[]): T[] => values.filter((value, index) => values.indexOf(value) === index);

const readExtensionPackageJson = (repoRoot: string, packageDir: string): ExtensionPackageJson =>
  JSON.parse(readFileSync(path.join(repoRoot, 'packages', packageDir, 'package.json'), 'utf8')) as ExtensionPackageJson;

const orderExtensionDirsForInstall = (repoRoot: string, packageDirs: string[]): string[] => {
  const dirs = unique(packageDirs);
  const packagesByDir = new Map(dirs.map(directory => [directory, readExtensionPackageJson(repoRoot, directory)]));
  const dirsByExtensionId = new Map(
    dirs.map(directory => {
      const extensionPackage = packagesByDir.get(directory)!;
      return [`${extensionPackage.publisher}.${extensionPackage.name}`.toLowerCase(), directory];
    })
  );
  const orderedDirs: string[] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (directory: string): void => {
    if (visited.has(directory) || visiting.has(directory)) return;
    visiting.add(directory);
    packagesByDir
      .get(directory)
      ?.extensionDependencies?.map(id => dirsByExtensionId.get(id.toLowerCase()))
      .filter((dependencyDir): dependencyDir is string => dependencyDir !== undefined)
      .map(visit);
    visiting.delete(directory);
    visited.add(directory);
    orderedDirs.push(directory);
  };

  dirs.map(visit);
  return orderedDirs;
};

const resolveLocalExtensions = async (repoRoot: string, packageDirs: string[]): Promise<LocalVsixExtension[]> =>
  await Promise.all(
    orderExtensionDirsForInstall(repoRoot, packageDirs).map(async packageDir => {
      const extensionPackage = readExtensionPackageJson(repoRoot, packageDir);
      const packagePath = path.join(repoRoot, 'packages', packageDir);
      const vsixFiles = existsSync(packagePath) ? readdirSync(packagePath).filter(file => file.endsWith('.vsix')).toSorted() : [];
      if (vsixFiles.length !== 1) {
        throw new Error(
          `Expected exactly 1 VSIX in packages/${packageDir}/ but found ${vsixFiles.length}: [${vsixFiles.join(', ')}]. ` +
            `Run 'npm run vscode:package -w ${packageDir}' first.`
        );
      }
      const vsixPath = path.join(packagePath, vsixFiles[0]);
      return {
        packageDir,
        id: `${extensionPackage.publisher}.${extensionPackage.name}`,
        version: extensionPackage.version,
        vsixPath,
        sha256: crypto.createHash('sha256').update(await fs.readFile(vsixPath)).digest('hex')
      };
    })
  );

const computeCacheKey = (extensions: LocalVsixExtension[], marketplaceExtensions: string[]): string =>
  crypto
    .createHash('sha256')
    .update(JSON.stringify({ vsix: extensions.map(extension => extension.sha256), marketplaceExtensions }))
    .digest('hex')
    .slice(0, 16);

const capturedCommand = (command: string, args: string[]): string => {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
    shell: process.platform === 'win32',
    stdio: 'pipe'
  });
  if (result.error || result.status !== 0) {
    const diagnostics = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim().slice(-DIAGNOSTIC_LIMIT);
    throw new Error(
      `VS Code CLI failed with exit ${result.status ?? 'unknown'}${result.error ? `: ${result.error.message}` : ''}` +
        `${diagnostics ? `\nCaptured diagnostics (last ${diagnostics.length} characters):\n${diagnostics}` : ''}`
    );
  }
  return result.stdout;
};

const extensionDirectory = (extensionsDir: string, extension: InstalledExtension): string => {
  if (extension.relativeLocation) return path.resolve(extensionsDir, extension.relativeLocation);
  const location = extension.location?.fsPath ?? extension.location?.path;
  if (!location) throw new Error(`Installed extension ${extension.identifier?.id ?? '<unknown>'} has no directory location`);
  const decoded = decodeURIComponent(location);
  return process.platform === 'win32' && /^\/[A-Za-z]:/u.test(decoded) ? decoded.slice(1) : decoded;
};

const expectedProvenance = (
  extensions: LocalVsixExtension[],
  marketplaceExtensions: string[]
): ProvenanceManifest => ({ extensions, marketplaceExtensions });

const validateCache = async (
  extensionsDir: string,
  expectedExtensions: LocalVsixExtension[],
  marketplaceExtensions: string[],
  vscodeExecutable: string
): Promise<PreparedVsixExtension[]> => {
  const provenance = JSON.parse(await fs.readFile(path.join(extensionsDir, PROVENANCE_FILE), 'utf8')) as ProvenanceManifest;
  const expected = expectedProvenance(expectedExtensions, marketplaceExtensions);
  if (JSON.stringify(provenance) !== JSON.stringify(expected)) {
    throw new Error('Invalid VSIX cache provenance manifest');
  }

  const installed = JSON.parse(await fs.readFile(path.join(extensionsDir, 'extensions.json'), 'utf8')) as InstalledExtension[];
  const expectedById = new Map(expectedExtensions.map(extension => [extension.id.toLowerCase(), extension]));
  const localInstalled = installed.filter(extension => extension.metadata?.source === 'vsix');
  const localIds = localInstalled.map(extension => extension.identifier?.id?.toLowerCase());
  const duplicates = localIds.filter((id, index) => id !== undefined && localIds.indexOf(id) !== index);
  const localInventory = localInstalled.map(extension => `${extension.identifier?.id ?? '<missing-id>'}@${extension.version ?? '<missing-version>'}`);
  const expectedInventory = expectedExtensions.map(extension => `${extension.id}@${extension.version}`);
  if (
    localInstalled.length !== expectedExtensions.length ||
    duplicates.length > 0 ||
    localInstalled.some(extension => {
      const expectedExtension = extension.identifier?.id
        ? expectedById.get(extension.identifier.id.toLowerCase())
        : undefined;
      return !expectedExtension || extension.version !== expectedExtension.version;
    })
  ) {
    throw new Error(
      `Invalid local VSIX inventory. Expected exactly [${expectedInventory.join(', ')}], found [${localInventory.join(', ')}]`
    );
  }

  const prepared = await Promise.all(
    expectedExtensions.map(async expectedExtension => {
      const installedExtension = localInstalled.find(
        extension => extension.identifier?.id?.toLowerCase() === expectedExtension.id.toLowerCase()
      )!;
      const directory = extensionDirectory(extensionsDir, installedExtension);
      const relativeDirectory = path.relative(extensionsDir, directory);
      if (relativeDirectory.startsWith('..') || path.isAbsolute(relativeDirectory)) {
        throw new Error(`Installed extension ${expectedExtension.id} references directory outside cache: ${directory}`);
      }
      const extensionPackage = JSON.parse(
        await fs.readFile(path.join(directory, 'package.json'), 'utf8')
      ) as ExtensionPackageJson;
      const packageId = `${extensionPackage.publisher}.${extensionPackage.name}`;
      if (packageId.toLowerCase() !== expectedExtension.id.toLowerCase() || extensionPackage.version !== expectedExtension.version) {
        throw new Error(
          `Installed extension directory mismatch for ${expectedExtension.id}: package.json contains ${packageId}@${extensionPackage.version}`
        );
      }
      return {
        directory,
        id: expectedExtension.id,
        version: expectedExtension.version,
        vsixPath: expectedExtension.vsixPath,
        sha256: expectedExtension.sha256
      };
    })
  );

  const cli = resolveCliPathFromVSCodeExecutablePath(vscodeExecutable);
  const listed = capturedCommand(cli, ['--extensions-dir', extensionsDir, '--list-extensions', '--show-versions'])
    .split(/\r?\n/u)
    .map(line => line.trim().toLowerCase())
    .filter(Boolean);
  const missing = [
    ...expectedExtensions.map(extension => `${extension.id}@${extension.version}`.toLowerCase()),
    ...marketplaceExtensions.map(id => `${id.toLowerCase()}@`)
  ].filter(expectedEntry =>
    expectedEntry.endsWith('@') ? !listed.some(entry => entry.startsWith(expectedEntry)) : !listed.includes(expectedEntry)
  );
  if (missing.length > 0) {
    throw new Error(`Invalid VS Code CLI extension inventory. Missing [${missing.join(', ')}], found [${listed.join(', ')}]`);
  }
  return prepared;
};

const isFileSystemError = (error: unknown, code: string): boolean =>
  error instanceof Error && 'code' in error && error.code === code;

type CacheLockOwner = {
  pid: number;
  createdAt: number;
  token: string;
};

const isProcessAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return isFileSystemError(error, 'EPERM');
  }
};

const isCacheLockStale = async (lockDir: string): Promise<boolean> => {
  const lockAge = Date.now() - (await fs.stat(lockDir)).mtimeMs;
  try {
    const owner = JSON.parse(await fs.readFile(path.join(lockDir, LOCK_OWNER_FILE), 'utf8')) as Partial<CacheLockOwner>;
    return typeof owner.pid !== 'number' || typeof owner.createdAt !== 'number' ||
      !isProcessAlive(owner.pid) || Date.now() - owner.createdAt > LOCK_STALE_MS;
  } catch (error) {
    if (!isFileSystemError(error, 'ENOENT') && !(error instanceof SyntaxError)) throw error;
    return lockAge > LOCK_STALE_MS;
  }
};

const removeStaleCacheLock = async (lockDir: string): Promise<void> => {
  const abandonedDir = `${lockDir}.abandoned.${process.pid}.${crypto.randomUUID()}`;
  try {
    await fs.rename(lockDir, abandonedDir);
  } catch (error) {
    if (isFileSystemError(error, 'ENOENT')) return;
    throw error;
  }
  await fs.rm(abandonedDir, { recursive: true, force: true });
};

const acquireCacheLock = async (lockDir: string): Promise<() => Promise<void>> => {
  await fs.mkdir(path.dirname(lockDir), { recursive: true });
  const owner: CacheLockOwner = { pid: process.pid, createdAt: Date.now(), token: crypto.randomUUID() };
  const deadline = Date.now() + LOCK_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      await fs.mkdir(lockDir);
      try {
        await fs.writeFile(path.join(lockDir, LOCK_OWNER_FILE), JSON.stringify(owner));
      } catch (error) {
        await fs.rm(lockDir, { recursive: true, force: true });
        throw error;
      }
      return async () => {
        try {
          const currentOwner = JSON.parse(await fs.readFile(path.join(lockDir, LOCK_OWNER_FILE), 'utf8')) as CacheLockOwner;
          if (currentOwner.token === owner.token) await fs.rm(lockDir, { recursive: true, force: true });
        } catch (error) {
          if (!isFileSystemError(error, 'ENOENT')) throw error;
        }
      };
    } catch (error) {
      if (!isFileSystemError(error, 'EEXIST')) throw error;
      try {
        if (await isCacheLockStale(lockDir)) {
          await removeStaleCacheLock(lockDir);
          continue;
        }
      } catch (staleCheckError) {
        if (isFileSystemError(staleCheckError, 'ENOENT')) continue;
        throw staleCheckError;
      }
      await new Promise(resolve => setTimeout(resolve, LOCK_RETRY_MS));
    }
  }
  throw new Error(`Timed out after ${LOCK_TIMEOUT_MS}ms waiting for VSIX cache lock ${lockDir}`);
};

const removeInvalidCache = async (extensionsDir: string): Promise<void> => {
  const invalidDir = `${extensionsDir}.invalid.${process.pid}.${crypto.randomUUID()}`;
  try {
    await fs.rename(extensionsDir, invalidDir);
  } catch (error) {
    if (isFileSystemError(error, 'ENOENT')) return;
    throw error;
  }
  await fs.rm(invalidDir, { recursive: true, force: true });
};

const installCache = async (
  extensionsDir: string,
  extensions: LocalVsixExtension[],
  marketplaceExtensions: string[],
  vscodeExecutable: string
): Promise<void> => {
  const temporaryDir = await fs.mkdtemp(`${extensionsDir}.tmp.${process.pid}.`);
  const userDataDir = path.join(temporaryDir, '.ud');
  const cli = resolveCliPathFromVSCodeExecutablePath(vscodeExecutable);
  try {
    extensions.map(extension =>
      capturedCommand(cli, [
        '--extensions-dir',
        temporaryDir,
        '--user-data-dir',
        userDataDir,
        '--install-extension',
        extension.vsixPath
      ])
    );
    marketplaceExtensions.map(id =>
      capturedCommand(cli, [
        '--extensions-dir',
        temporaryDir,
        '--user-data-dir',
        userDataDir,
        '--install-extension',
        id,
        '--force'
      ])
    );
    await fs.writeFile(
      path.join(temporaryDir, PROVENANCE_FILE),
      JSON.stringify(expectedProvenance(extensions, marketplaceExtensions), undefined, 2)
    );
    await validateCache(temporaryDir, extensions, marketplaceExtensions, vscodeExecutable);
    await fs.rename(temporaryDir, extensionsDir);
  } catch (error) {
    await fs.rm(temporaryDir, { recursive: true, force: true });
    throw error;
  }
};

/** Prepares root-built VSIXs in an isolated, content-addressed VS Code extensions cache. */
export const prepareVsixExtensions = async ({
  repoRoot,
  packageDirs,
  vscodeExecutable,
  marketplaceExtensions: requestedMarketplaceExtensions = []
}: PrepareVsixExtensionsOptions): Promise<PreparedVsixExtensions> => {
  const extensions = await resolveLocalExtensions(repoRoot, packageDirs);
  const marketplaceExtensions = unique(requestedMarketplaceExtensions.map(id => id.toLowerCase())).toSorted();
  const cacheKey = computeCacheKey(extensions, marketplaceExtensions);
  const extensionsDir = path.join(repoRoot, '.vscode-test', `ext-${cacheKey}`);
  const releaseLock = await acquireCacheLock(`${extensionsDir}.lock`);
  try {
    if (existsSync(extensionsDir)) {
      try {
        return {
          extensionsDir,
          extensions: await validateCache(extensionsDir, extensions, marketplaceExtensions, vscodeExecutable)
        };
      } catch {
        await removeInvalidCache(extensionsDir);
      }
    }
    await installCache(extensionsDir, extensions, marketplaceExtensions, vscodeExecutable);
    return {
      extensionsDir,
      extensions: await validateCache(extensionsDir, extensions, marketplaceExtensions, vscodeExecutable)
    };
  } finally {
    await releaseLock();
  }
};
