# Protect the next-major public API

The next `@salesforce/apex-node` major protects the package root used by known
CLI and public GitHub consumers. The baseline intentionally excludes unused
runtime exports, public implementation helpers, VS Code-only reporters, and the
legacy `lib/src/tests/types.js` path.

Effect schemas record the JSON-representable contracts under `schemas/`.
Package lint fails when the generated JSON Schema differs from the checked-in
contract, and build-time type assertions keep the schemas aligned with the
exported TypeScript types. A focused test protects the target runtime exports
and root-only package `exports` map. Co-repo TypeScript consumers continue to
compile against the class and callback APIs that JSON Schema cannot represent.

Intentional API changes require review plus an explicit schema update. Internal
modules can otherwise move or change without altering the approved schema.

The baseline retains externally used services, reporters, result values, and
the types reachable through them. `DefaultWatermarks` remains public because an
external consumer subclasses `CoverageReporter` and supplies it.

Published enum values become type-only string unions. Type-only packages remain
development dependencies.

VS Code-only declarations remain available where the co-repo extension needs
them, but carry `@internal` and are excluded from the public JSON schema and
supported runtime export list. They may change without a major release.

GitHub default-branch searches cannot find private or non-default-branch
consumers. This reduction therefore requires a major release and migration
notes. The generated schema and package-entry test prevent unreviewed drift
after that deliberate break.
