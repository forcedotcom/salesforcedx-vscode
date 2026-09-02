# Protect the next-major public API

The next `@salesforce/apex-node` major protects the package root used by known
CLI and public GitHub consumers. The baseline intentionally excludes unused
runtime exports, public implementation helpers, VS Code-only reporters, and the
legacy `lib/src/tests/types.js` path.

API Extractor records the target TypeScript contract under `etc/`. Package lint
fails when built declarations differ from that report. A focused test protects
the target runtime exports and root-only package `exports` map.

Intentional API changes require review plus an explicit report update. Internal
modules can otherwise move or change without altering the approved reports.

The baseline retains externally used services, reporters, result values, and
the types reachable through them. `DefaultWatermarks` remains public because an
external consumer subclasses `CoverageReporter` and supplies it.

Published enum values use readonly literal objects plus derived union types
instead of TypeScript enums. Type-only packages remain development dependencies.

VS Code-only declarations remain available where the co-repo extension needs
them, but carry `@internal` and are excluded from the public API report. They may
change without a major release.

GitHub default-branch searches cannot find private or non-default-branch
consumers. This reduction therefore requires a major release and migration
notes. API reports prevent unreviewed drift after that deliberate break.
