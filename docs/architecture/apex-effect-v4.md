# Apex Effect V4 prerequisite

W-24615048; remove the temporary interoperability entry and V3 adapter in W-24615069.

## Entries and runtime ownership

- `@salesforce/apex-node`: unchanged CommonJS Promise/class API and declaration paths.
- `/effect`: native ESM, installed Effect **4.0.6**, V4 Effects/schemas/tagged errors.
- `/execute-anonymous-compat`: internal migration-only CommonJS Promise/data entry;
  not an external supported Apex capability.
- `compile` runs TypeScript, copies the Effect-directory ESM marker, then bundles
  root/compat as CommonJS with V4 included. Other packages, including the SDK,
  stay external. `keepNames` preserves the constructor names read by timing logs.
- Root/compat can contain separate physical V4 implementations. Neither owns a
  persistent service graph. Both execute the same source implementation. No
  runnable embedded-runtime value leaves either entry.
- Unsupported deep `out/` imports are not repaired by root bundling. Package
  exports continue to prohibit them.

## Temporary services adapter

`salesforcedx-vscode-services/src/core/executeAnonymousCompat.ts` uses genuine V3
errors/Effects and the encoded Apex result protocol. Production services remains
V3 until its assigned migration WI.

- Results preserve coordinates and absent/empty logs; failures retain nullable diagnostics.
- Typed failures encode through the 4 existing Apex error schemas into plain
  records. Receiver reconstructs local V3 tagged errors. Encoder/decoder failures
  become defects without dropping later reasons.
- Every ordered Fail/Die/Interrupt reason crosses; opaque defects retain identity.
  V3 sequential/parallel topology, FiberRefs and tracing context do not cross.
- Check pre-aborted signals before V4 execution. V3 interruption aborts its V4
  operation, waits masked for completion/finalizers, and retains finalizer failures.
- HTTP/server cancellation is not promised: the SDK `connection.request` does not
  receive this signal.
- Keep the adapter local: current first-party services resolves V3 **3.22.2**;
  the external compatibility implementation pins **3.21.2**. Sharing its compiled
  typed helper failed nominal Effect-type checks. No casts or dependency downgrade.
- Schema-derived protocol declarations make services analysis see **3.22.2 and
  4.0.6**. Its `duplicatePackage` warnings are expected until this temporary
  boundary is removed in W-24615069. Do not globally suppress duplicates or change
  enforced diagnostics. Raw services diagnostics are not clean: the 3 unchanged
  `unsupportedServiceAccessors` warnings concern generic Query/Fs/Settings methods;
  separately verified on the parent checkout.

## Schema compatibility

- SOAP booleans remain exactly `"true"`/`"false"`, not V4's wider boolean vocabulary.
- SOAP integers still reject blank/whitespace text. V4 `NumberFromString` otherwise
  converts those inputs to zero; regression tests passed first on V3.
- Preserve nil/empty diagnostic elements, inconsistent-flag rejection, and exactly
  1 session-refresh retry with a rebuilt request.
- JSON generation uses `Finite` and `optionalKey`: no new `"Infinity"`/`"NaN"`
  string encodings or nullable optional fields. Runtime schemas retain their
  existing numeric/undefined behavior.
- `publicApiSchemaContract.mjs` normalizes references, annotations, equivalent
  union nesting and ordering. Validation hash matches parent `bb6b6458fa`:
  `9f2619054426b7cf824185855af06081a5532e990fbfb47f3de5cd252550725d`.
- Public Istanbul declaration dependencies belong in package dependencies, not
  devDependencies; isolated strict root consumers require them.

## Verification scope and known runtime-floor failure

Independent packed fixtures install their own dependencies outside the checkout:
native root CJS/ESM imports, Node16 declaration resolution, V4 execution, actual V3
services adapter, encoded/mixed Causes, cancellation/finalizers, and browser bundles.
Browser-target bundles are not browser E2E; GitHub desktop/web E2E remains required.

Native Node **22.0.0** root loading fails before Apex execution in locked
`@jsforce/jsforce-node@3.10.29` → `undici@8.12.1`:
`createZstdDecompress.bind` accesses an unavailable Node API. Reproduced on the
unchanged `bb6b6458fa` parent in a separate checkout after frozen install and
normal Apex compilation. This is not a V4 regression or a passing root-floor test.
Do not raise Apex's `>=22.0.0` engine or suppress the failure. Pure `/effect` and
compat-entry Node 22 tests isolate the new module-format behavior; SDK-dependent
root-floor acceptance still requires dependency resolution.
