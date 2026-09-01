# Protect the published API with compatibility reports

`@salesforce/apex-node` has 2 supported entry points: the package root and the
legacy `lib/src/tests/types.js` compatibility path. Their names, methods, types,
enum values, and package paths are compatibility contracts.

API Extractor rolls both entry points into checked-in reports under `etc/`.
Package lint fails when built declarations differ from either report. A focused
test protects runtime exports and the package `exports` map.

Intentional API changes require review plus an explicit report update. Internal
modules can otherwise move or change without altering the approved reports.

The initial reports retain existing forgotten-export warnings. Those warnings
document reachable types that were not explicitly exported; adopting the gate
does not silently expand the package API to resolve that legacy debt.
