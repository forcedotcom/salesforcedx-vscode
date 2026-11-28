import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { commonConfigBrowser } from './bundling/web.mjs';
import {
  createPackedFixturesDirectory,
  installAndCompileFixtures,
  packServicesExtension,
  packServicesPackage
} from './packedServicesFixtures.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temp = createPackedFixturesDirectory('salesforce-v4-foundations-');
const directory = path.join(temp, 'foundations');
const decoderDirectory = path.join(temp, 'decoderConsumer');
const cli = path.join(root, 'node_modules/@effect/language-service/cli.js');

try {
  const packedPackages = [
    packServicesPackage(path.join(root, 'packages/salesforcedx-apex'), directory, 'apex.tgz'),
    packServicesPackage(path.join(root, 'packages/salesforcedx-utils'), directory, 'utils.tgz'),
    packServicesPackage(path.join(root, 'packages/salesforcedx-vscode-i18n'), directory, 'i18n.tgz'),
    packServicesPackage(path.join(root, 'packages/salesforcedx-vscode-services-types'), directory, 'legacy.tgz'),
    packServicesPackage(path.join(root, 'packages/salesforcedx-vscode-services-v3-compat'), directory, 'compat.tgz'),
    packServicesExtension(path.join(root, 'packages/salesforcedx-vscode-services'), directory, 'services.tgz')
  ];
  fs.mkdirSync(decoderDirectory, { recursive: true });
  await installAndCompileFixtures([
    { fixture: 'foundations', directory, packedPackages },
    { fixture: 'decoderConsumer', directory: decoderDirectory, packedPackages: [] }
  ]);
  const require = createRequire(path.join(directory, 'package.json'));
  const decoderRequire = createRequire(path.join(decoderDirectory, 'package.json'));
  const servicesRequire = createRequire(path.join(directory, 'node_modules/salesforcedx-vscode-services/package.json'));
  assert.equal(require('effect/package.json').version, '4.1.4');
  assert.equal(require.resolve('effect/Effect'), servicesRequire.resolve('effect/Effect'));
  assert.equal(decoderRequire('effect/package.json').version, '4.1.4');
  assert.notEqual(
    fs.realpathSync(require.resolve('effect/Schema')),
    fs.realpathSync(decoderRequire.resolve('effect/Schema'))
  );
  assert.notEqual(
    await import(pathToFileURL(require.resolve('effect/Schema')).href),
    await import(pathToFileURL(decoderRequire.resolve('effect/Schema')).href),
    'decoder consumer must use an independently installed live Schema module'
  );

  fs.copyFileSync(path.join(directory, 'cjsConsumer.ts'), path.join(directory, 'cjsConsumer.cts'));
  const commonJs = spawnSync(
    process.execPath,
    [
      path.join(directory, 'node_modules/typescript/bin/tsc'),
      '--ignoreConfig',
      '--noEmit',
      '--strict',
      '--skipLibCheck',
      'false',
      '--module',
      'Node16',
      '--moduleResolution',
      'Node16',
      '--target',
      'ES2024',
      path.join(directory, 'cjsConsumer.cts')
    ],
    { cwd: directory, encoding: 'utf8', timeout: 180000 }
  );
  assert.equal(commonJs.error, undefined);
  assert.equal(
    commonJs.status,
    0,
    `CommonJS URI-helper consumer must compile under Node16 resolution: ${commonJs.stdout}${commonJs.stderr}`
  );

  fs.writeFileSync(
    path.join(directory, 'tsconfig.negative.json'),
    JSON.stringify({
      extends: './tsconfig.json',
      include: ['negative.ts']
    })
  );
  const negative = spawnSync(
    process.execPath,
    [path.join(directory, 'node_modules/typescript/bin/tsc'), '-p', path.join(directory, 'tsconfig.negative.json')],
    {
      cwd: directory,
      encoding: 'utf8',
      timeout: 180000
    }
  );
  assert.equal(negative.error, undefined);
  assert.notEqual(negative.status, 0, 'missing foundational dependencies must fail TypeScript');
  assert.match(negative.stdout, /WebFileSystemProvider/);
  assert.match(negative.stdout, /ChannelService/);
  assert.doesNotMatch(negative.stdout, /Cannot find module/);

  const enforced = JSON.parse(fs.readFileSync(path.join(root, 'config/effect-diagnostics.json'), 'utf8')).enforcedRules;
  const diagnosticRun = spawnSync(
    process.execPath,
    [
      cli,
      'diagnostics',
      '--project',
      path.join(directory, 'tsconfig.json'),
      '--format',
      'json',
      '--lspconfig',
      JSON.stringify({ diagnosticSeverity: Object.fromEntries(enforced.map(rule => [rule, 'error'])) })
    ],
    { cwd: root, encoding: 'utf8', timeout: 180000 }
  );
  assert.equal(diagnosticRun.error, undefined);
  assert.notEqual(diagnosticRun.status, 0, 'negative V4 diagnostic controls must fail the CLI');
  const diagnostics = JSON.parse(diagnosticRun.stdout);
  for (const name of ['floatingEffect', 'runEffectInsideEffect']) {
    assert(
      diagnostics.diagnostics.some(finding => finding.name === name && finding.file.endsWith('diagnostics.ts')),
      `V4 ${name} control must report`
    );
  }
  assert.deepEqual(
    diagnostics.diagnostics
      .filter(finding => finding.file.endsWith('positive.ts'))
      .map(({ name, message }) => ({ name, message })),
    [],
    'positive foundational graph must have clean LS diagnostics'
  );
  console.log(
    'PASS strict packed foundation declarations, actual V4 diagnostics controls and missing-layer negative controls'
  );

  const vscodeHost = {
    name: 'foundation-test-vscode-host',
    setup: bundler => {
      bundler.onResolve({ filter: /^vscode$/ }, () => ({ path: path.join(directory, 'vscode.mjs') }));
    }
  };
  // Browser FS polyfills live in this checkout; resolve their SDK import into the isolated packed consumer too.
  const packedCore = {
    name: 'packed-consumer-core',
    setup: bundler => {
      bundler.onResolve({ filter: /^@salesforce\/core(?:\/|$)/ }, args => ({ path: require.resolve(args.path) }));
    }
  };
  for (const platform of ['node', 'browser']) {
    const decoderOutfile = path.join(decoderDirectory, `${platform}-decoder.mjs`);
    await build({
      entryPoints: [path.join(decoderDirectory, 'consumer.ts')],
      outfile: decoderOutfile,
      bundle: true,
      format: 'esm',
      platform,
      target: 'es2024',
      external: platform === 'node' ? ['effect', 'effect/*'] : []
    });
    const independentDecoder = {
      name: 'independently-installed-caller-decoder',
      setup: bundler =>
        bundler.onResolve({ filter: /decoderConsumer\/consumer\.js$/ }, () => ({
          path: pathToFileURL(decoderOutfile).href,
          external: true
        }))
    };
    const outfile = path.join(directory, `${platform}-bundle.mjs`);
    const result = await build({
      ...(platform === 'browser' ? commonConfigBrowser : {}),
      entryPoints: [path.join(directory, 'runtime.mjs')],
      outfile,
      bundle: true,
      format: 'esm',
      platform,
      target: 'es2024',
      sourcemap: false,
      metafile: true,
      external:
        platform === 'node'
          ? [
              '@salesforce/core',
              '@salesforce/core/*',
              '@salesforce/source-deploy-retrieve',
              'effect',
              'effect/*',
              'vscode-uri'
            ]
          : [],
      plugins: [
        ...(platform === 'browser' ? [...(commonConfigBrowser.plugins ?? []), packedCore] : []),
        vscodeHost,
        independentDecoder
      ]
    });
    assert(
      Object.keys(result.metafile.inputs).some(file => file.includes('salesforcedx-vscode-services/out/src/')),
      'bundle must use the actual packed implementation'
    );
    const dom =
      platform === 'browser'
        ? new (require('jsdom').JSDOM)('<!doctype html>', { url: 'https://fixture.example/' })
        : undefined;
    const previous = new Map();
    if (dom) {
      // The real browser bundle installs process/Buffer globals; keep them inside this test's lifetime.
      for (const name of ['process', 'Buffer']) previous.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
      for (const name of ['window', 'document', 'navigator']) {
        previous.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
        Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
      }
    }
    try {
      const { observed } = await import(pathToFileURL(outfile).href);
      assert.deepEqual(observed, {
        workspaceWatchers: 1,
        workspaceDisposed: 1,
        settingsWatchers: 1,
        settingsDisposed: 1,
        path: 'memfs:/fixture',
        token: '<redacted>',
        aliases: ['fixture-alias'],
        files: [`memfs:/fixture/${platform === 'browser' ? 'web' : 'desktop'}-result.cls`],
        orgRefClosed: true,
        callerDecoding: {
          foreignSchemaAccepted: true,
          id: '005000000000001',
          label: 'independent:Caller',
          parentSpan: 'packed.readJSON',
          typedErrorIdentity: true,
          defectIdentity: true
        }
      });
      console.log(`PASS actual packed ${platform}-target foundation graph`);
      const projectOutfile = path.join(directory, `${platform}-project-bundle.mjs`);
      await build({
        ...(platform === 'browser' ? commonConfigBrowser : {}),
        entryPoints: [path.join(directory, 'projectRuntime.mjs')],
        outfile: projectOutfile,
        bundle: true,
        format: 'esm',
        platform,
        target: 'es2024',
        sourcemap: false,
        external:
          platform === 'node'
            ? [
                '@salesforce/core',
                '@salesforce/core/*',
                '@salesforce/source-deploy-retrieve',
                'effect',
                'effect/*',
                'vscode-uri'
              ]
            : [],
        plugins: [
          ...(platform === 'browser' ? [...(commonConfigBrowser.plugins ?? []), packedCore] : []),
          vscodeHost,
          independentDecoder
        ]
      });
      const { observed: project } = await import(pathToFileURL(projectOutfile).href);
      assert.equal(project.backend, platform === 'browser' ? 'memfs' : 'node');
      assert.deepEqual(project.names, ['One', 'Other']);
      assert.deepEqual(project.manifestNames, ['One']);
      assert.deepEqual(project.filteredNames, ['Other']);
      assert.equal(project.sameNonEmpty, true);
      assert.equal(project.apiVersion, '68.0');
      assert.equal(project.sourceApiVersion, '67.0');
      assert.equal(project.projectDirectory, project.expectedProjectDirectory);
      assert.equal(project.projectPath, project.expectedProjectDirectory);
      assert.equal(project.customOutput, project.expectedOutput);
      assert.equal(project.namespace, 'Fixture');
      assert.equal(project.registrySuffix, 'cls');
      assert.equal(project.nativeProject, true);
      assert.equal(project.nativeRegistry, true);
      assert.equal(project.namespaceEligible, true);
      assert.equal(project.nullNamespaceEligible, false);
      assert.equal(project.debugLogsFolder, project.expectedDebugLogsFolder);
      assert.equal(project.inPackageDirectories, true);
      assert.equal(project.outsideError, 'NotInPackageDirectoryError');
      assert.deepEqual(project.outsideUris, project.expectedOutsideUris);
      assert.equal(project.closedAdmission, true);
      assert.equal(project.createdChannels, 1);
      assert.equal(project.disposedChannels, 1);
      console.log(`PASS actual packed ${platform}-target native project/registry/ComponentSet discovery and teardown`);
      const catalogOutfile = path.join(directory, `${platform}-catalog-bundle.mjs`);
      const catalogBundle = await build({
        ...(platform === 'browser' ? commonConfigBrowser : {}),
        // Like nodeEsmConfig, supply require for bundled CJS native dependencies (cross-spawn).
        // vscode is already resolved to the fixture host by the plugin, not an external module.
        ...(platform === 'node'
          ? {
              banner: {
                js: "import { createRequire as __fixtureRequire } from 'node:module'; const require = __fixtureRequire(import.meta.url); const __dirname = import.meta.dirname; const __filename = import.meta.filename;"
              }
            }
          : {}),
        entryPoints: [path.join(directory, 'catalogRuntime.mjs')],
        outfile: catalogOutfile,
        bundle: true,
        format: 'esm',
        platform,
        target: 'es2024',
        sourcemap: false,
        metafile: true,
        external:
          platform === 'node'
            ? [
                '@salesforce/core',
                '@salesforce/core/*',
                '@salesforce/source-deploy-retrieve',
                '@salesforce/source-tracking',
                '@salesforce/source-tracking/*',
                'effect',
                'effect/*',
                'vscode-uri'
              ]
            : [],
        plugins: [
          ...(platform === 'browser' ? [...(commonConfigBrowser.plugins ?? []), packedCore] : []),
          vscodeHost,
          independentDecoder
        ]
      });
      assert(
        Object.keys(catalogBundle.metafile.inputs).some(file =>
          file.includes('salesforcedx-vscode-services/out/src/services/orgCatalog/orgCatalogRemoteRetrieve.js')
        )
      );
      const { observed: catalog } = await import(pathToFileURL(catalogOutfile).href);
      assert.deepEqual(catalog.callerDecoding, {
        firstPageLabels: ['first:First', 'first:Second'],
        subsequentLabels: ['second:Third', 'third:Third'],
        initialSpan: 'QueryService.query',
        laterSpan: 'packed.records',
        typedErrorIdentity: true,
        schemaErrorPath: true,
        finalizedOnInterrupt: true
      });
      console.log(
        `PASS independent Effect 4 installations/${platform}-target bundles: caller JSON/page decoding, A/E/R, schema paths, lazy replay, tracing and cancellation`
      );
      assert.equal(catalog.backend, platform === 'browser' ? 'memfs' : 'node');
      assert.equal(catalog.nativeConnection, true);
      assert.equal(catalog.sameLegacyConnection, true);
      assert.deepEqual(catalog.contextKeys, catalog.expectedContextKeys);
      assert.equal(catalog.contextKeys.length, 34);
      assert.equal(catalog.createdExtensionListeners, 1);
      assert.equal(catalog.disposedExtensionListeners, 1);
      assert.equal(catalog.traceFlagsClosed, true);
      assert.deepEqual(catalog.traceFlagRecords, [
        {
          id: '7tf000000000001',
          logType: 'DEVELOPER_LOG',
          expirationDate: '2030-01-01T00:00:00.000Z',
          isActive: true,
          missingStartDate: true,
          missingDebugLevel: true
        }
      ]);
      assert.equal(catalog.disposedDiagnostics, 1);
      assert.deepEqual(catalog.anonymousExecution, {
        result: { compiled: false, success: false, line: 3, column: 2, compileProblem: 'Unexpected token' },
        logBody: 'Packed anonymous log',
        output: ['Error: Line 3, Column 2 -- Unexpected token', 'Packed anonymous log'],
        diagnostic: [{ message: 'Unexpected token', line: 7, character: 1 }]
      });
      assert.deepEqual(catalog.apexLogs, {
        records: [
          { Id: '07L000000000001', LogLength: 20, StartTime: '2026-11-02T00:00:00Z', Status: 'Success', LogUser: {} }
        ],
        body: 'Packed Apex log body'
      });
      assert.deepEqual(catalog.templateCreation, {
        names: ['DefaultApexClass'],
        created: ['generated/FixtureCreated.cls', 'generated/FixtureCreated.cls-meta.xml'],
        classContent: 'public with sharing class FixtureCreated { public FixtureCreated() {} }',
        versionFromProject: true,
        outputDirectory: true,
        stagedFiles: platform === 'browser' ? 3 : 0
      });
      assert.deepEqual(
        catalog.terminal,
        platform === 'browser'
          ? { errorType: 'unsupported_platform' }
          : { result: { args: ['space value', '; echo injected'], overlay: 'preserved' } }
      );
      const nativeProcessInputs = Object.keys(catalogBundle.metafile.inputs).filter(
        file => file.includes('crossSpawnChildProcessSpawner') || file.includes('cross-spawn/')
      );
      assert.equal(
        nativeProcessInputs.length > 0,
        platform === 'node',
        'browser bundle must exclude native process code'
      );
      assert.deepEqual(catalog.callerProgress, {
        prefix: 'independent-progress',
        sameScope: true,
        span: 'packed.progress'
      });
      assert.equal(catalog.promptSelection.sameDirectory, true);
      assert.deepEqual(catalog.promptSelection.directoryLabels, [
        'force-app/main/default/classes',
        'force-app/other/classes',
        '$(file-directory) Other Folder'
      ]);
      assert.deepEqual(catalog.promptSelection.warningCalls[0], {
        message: 'Confirm action',
        options: { modal: true, detail: 'Details' },
        buttons: ['Proceed']
      });
      assert.match(catalog.promptSelection.warningCalls[1].message, /Overwrite .*Local\.cls\?/);
      assert.deepEqual(catalog.promptSelection.warningCalls[1].buttons, ['Overwrite']);
      assert.deepEqual(catalog.promptSelection.warningCalls[1].options, { modal: true });
      assert.deepEqual(catalog.callerNotifications, {
        progressLocation: 15,
        returnedBeforeSelection: true,
        actionRan: true,
        text: '$(check) Native status',
        name: 'Fixture notifications',
        toastMessages: [
          { message: 'Native toast', labels: ['Open'] },
          { message: 'Native status', labels: [] }
        ],
        disposedStatus: 1,
        disposedCommand: 1,
        commandClosed: true,
        sameConnection: true
      });
      assert.equal(catalog.iconDescription, 'Localized $(sf-org-leaf)');
      assert.equal(catalog.createdEditorListeners, 1);
      assert.equal(catalog.disposedEditorListeners, 1);
      assert.equal(catalog.editorClosed, true);
      assert.equal(catalog.editorContext.text, 'public class Local { /* unchanged */ }');
      assert.match(catalog.editorContext.documentUri, /\/force-app\/main\/default\/classes\/Local\.cls$/);
      assert.deepEqual(catalog.editorContext.selectionStart, { line: 7, character: 12 });
      assert.equal(catalog.editorContext.selectionRange, undefined);
      assert.deepEqual(
        catalog.callerContexts,
        ['First extension', 'Second extension', undefined].map(displayName => ({
          nativeIdentity: true,
          displayName,
          sharedConnection: true
        }))
      );
      assert.equal(catalog.callerContextsOwnerUnchanged, true);
      assert.deepEqual(catalog.extracted, [0, 255, 128, 0, 1, 2]);
      assert.deepEqual(catalog.materialized, catalog.extracted);
      assert.match(catalog.primary, /metadata-shadow\/StaticResource\/Blob\/revisions\//);
      assert.equal(catalog.revision, '2026-10-30T00:00:00.000Z');
      assert.equal(catalog.fileCount, 2);
      assert.equal(catalog.retrieves, 3);
      assert.deepEqual(catalog.mergedBytes, catalog.extracted);
      assert.equal(catalog.deploys, 2);
      assert.equal(catalog.deployedStatus, 'Succeeded');
      assert(
        catalog.deployZipSizes.every(size => size > 0),
        'both native deploys must produce ZIP bytes'
      );
      assert.equal(catalog.destructiveMarked, true);
      assert(catalog.deleteStates.includes('Deleted'));
      assert.equal(catalog.localDeleted, true);
      assert.deepEqual(catalog.renamedFiles, [
        '__tests__',
        '__tests__/newBundle.small.test.js',
        'newBundle.html',
        'newBundle.js',
        'other.js'
      ]);
      assert(catalog.progressTitles.includes('Deploying 1 component'));
      assert(catalog.progressTitles.includes('Deleting 1 component'));
      assert.deepEqual(catalog.queriedUsernames, ['catalog@example.com']);
      assert.equal(catalog.unchangedSource, 'public class Local { /* unchanged */ }');
      assert.equal(catalog.active, 0);
      assert(!catalog.staging.some(name => name.endsWith('.__staging__')));
      assert.equal(catalog.closedAdmission, true);
      assert.equal(catalog.createdChannels, 1);
      assert.equal(catalog.disposedChannels, 1);
      assert.equal(catalog.progressListeners, 6);
      assert.equal(catalog.disposedProgressListeners, 6);
      assert.equal(catalog.createdProviders, 1);
      assert.equal(catalog.disposedProviders, 1);
      assert.equal(catalog.notification, 'sf-org-metadata:/orgs/00D000000000001/StaticResource/Blob.resource');
      console.log(
        `PASS actual packed ${platform}-target native merged retrieve/deploy/delete/rename/query, binary shadow/documents, public Context and teardown`
      );
    } finally {
      if (dom) {
        for (const [name, descriptor] of previous) {
          if (descriptor) Object.defineProperty(globalThis, name, descriptor);
          else delete globalThis[name];
        }
        dom.window.close();
      }
    }
  }
  console.log(
    'PASS real packed foundation graph in Node/browser-target bundles: scoped singletons, backend selection, redaction and teardown (browser bundle executes under Node, not VS Code E2E)'
  );
} catch (error) {
  console.error('Foundation services check failed:', error);
  process.exitCode = 1;
} finally {
  fs.rmSync(temp, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}
