# Extension host profiling

Use the **Launch Extensions** debug configuration to build debug bundles and start an extension host. In its Call Stack, choose **Take Performance Profile** to capture a CPU profile, sampling heap profile, or heap snapshot. Keep the bundle and `.map` files from that build until the transforms are done. Source maps from a later build can point to the wrong code.

From the repository root, transform files exported by VS Code:

```sh
node scripts/remapCpuProfile.mjs path/to/profile.cpuprofile
node scripts/remapHeapProfile.mjs path/to/profile.heapprofile
node scripts/mapHeapSnapshot.mjs path/to/snapshot.heapsnapshot
```

The CPU and heap commands create `.source-mapped.cpuprofile` and `.source-mapped.heapprofile` copies. They map frames in this repository's `packages/*/dist` bundles, including dependency frames where source maps provide locations. Frames without a source map entry stay as generated JavaScript. VS Code's extra location metadata is remapped along with the profile frames.

The snapshot command creates a `.source-mapped-locations.tsv` lookup table. Open the **original** `.heapsnapshot` in Chrome DevTools for object sizes and retaining paths. An imported snapshot has no live debugger script registry, so rewriting its script IDs would not give Chrome working source links. The table records each mappable object's Chrome `@id`, generated location, and original source location. Search it with `rg '^123\t' path/to/snapshot.source-mapped-locations.tsv` for an object shown as `@123` in Chrome. The `origin` column separates repository source from dependencies. The snapshot itself is not modified.

These transforms require the profile to contain the original bundle paths. VS Code's **Running Extensions** export can redact paths to `piiRemoved/index.js`; a redacted export needs script IDs matched to bundles before it can be remapped reliably.

For a CPU profile that starts before extension activation, use the startup launcher:

```sh
PROFILE_EXTENSIONS=salesforcedx-vscode-services,salesforcedx-vscode-core \
  ./scripts/launchWithProfiling.sh --workspace path/to/workspace
```

The launcher builds debug bundles, starts the selected development extensions with the extension host paused, records CPU activity from startup, and saves both raw and source-mapped CPU profiles when you press Enter in the terminal. `--workspace` is optional; without it, open your chosen workspace in the new window. Run `./scripts/launchWithProfiling.sh --help` for options.
