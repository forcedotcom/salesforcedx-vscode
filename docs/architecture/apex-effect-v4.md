# Apex Effect V4 prerequisite

W-24615048; W-24615069 removed the temporary interoperability entry after the
services consumer moved to V4.

## Entries and runtime ownership

- `@salesforce/apex-node`: unchanged CommonJS Promise/class API and declaration paths.
- `/effect`: native ESM, installed Effect **4.0.6**, V4 Effects/schemas/tagged errors.
- `compile` runs TypeScript, copies the Effect-directory ESM marker, then bundles
  the root as CommonJS with V4 included. Other packages, including the SDK,
  stay external. `keepNames` preserves the constructor names read by timing logs.
- The root retains its existing Promise/class API. `/effect` is the only Apex
  Effect entry; it owns no persistent services graph. No runnable embedded-runtime
  value leaves either entry.
- Unsupported deep `out/` imports are not repaired by root bundling. Package
  exports continue to prohibit them.

## Services cutover

`ExecuteAnonymousService` calls the V4 `/effect` operation directly. The temporary
Promise/AbortSignal/data adapter and `/execute-anonymous-compat` entry were removed
in W-24615069; no first-party services caller crosses Effect majors.

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
native root CJS/ESM imports, Node16 declaration resolution, V4 execution and browser
bundles. Browser-target bundles are not browser E2E; GitHub desktop/web E2E remains required.

Native Node **22.0.0** root loading fails before Apex execution in locked
`@jsforce/jsforce-node@3.10.29` → `undici@8.12.1`:
`createZstdDecompress.bind` accesses an unavailable Node API. Reproduced on the
unchanged `bb6b6458fa` parent in a separate checkout after frozen install and
normal Apex compilation. This is not a V4 regression or a passing root-floor test.
Do not raise Apex's `>=22.0.0` engine or suppress the failure. Pure `/effect` and
compat-entry Node 22 tests isolate the new module-format behavior; SDK-dependent
root-floor acceptance still requires dependency resolution.
