# CI

GitHub Actions vocabulary for this repo.

## Language

**Changelog ref**:
Schema-decoded git ref (SHA or tag) that bounds a changelog range. A release number is not one. Callers take this type, not a raw string.
_Avoid_: old SHA, new SHA, release number

**Changelog facts**:
Schema for one changelog range after skipped commit types are removed. Each kept commit carries its PR title, body, labels, the package set, and the paths that survived the path filter. The prompt is the encoded facts plus the changelog judgment skill text.
_Avoid_: raw git log, changelog markdown, skip-list rules in the prompt

**Changelog range**:
Ordered pair of changelog refs, `from` exclusive through `to` inclusive (`from..to`). Both inputs are required on the action. Two refs that resolve to the same commit fails the action. A range with no changelog facts succeeds with an empty changelog and does not call the model.
_Avoid_: SHA pair, release pair

**Skipped commit type**:
Conventional type removed before changelog facts are built: `chore`, `style`, `refactor`, `test`, `build`, `ci`, `revert`, `docs`.
_Avoid_: docs package (a path, not a type), `perf`

**Kept commit type**:
Conventional type that becomes a changelog fact: `feat`, `fix`, `perf`.
_Avoid_: skipped commit type

**Changelog package set**:
Packages left on a changelog fact. Drop `/images/` and `/test/` paths, packages that do not start with `salesforce` or `docs`, every package except `salesforcedx-vscode-core` and `docs` when core is present, and `salesforcedx-vscode-services` when exactly one feature package is also present.
_Avoid_: every touched package, raw path list

**Changelog sections**:
Effect Schema the model returns: `Added`, `Fixed`, `Changed`, and `Under the Hood`, each an array of `{ pr, sentence, package? }`. `package` is absent for Under the Hood and otherwise one of that fact's package set. The `pr` values across the arrays are exactly the fact PRs, once each. `Schema.decodeUnknown` yields this type or fails the action. `toMarkdown` accepts only this type.
_Avoid_: flat judgment list, markdown string, model-grouped prose

**Changelog body**:
Section markdown `toMarkdown` returns from decoded changelog sections: `## Added` / `## Fixed` / `## Changed` package entry lines (`sentence` + links); `## Under the Hood` one rollup bullet of PR/issue/discussion links (no `sentence`). No version header.
_Avoid_: version header, full changelog file, model-written markdown

**Changelog judgment skill**:
Cursor skill the script reads into the prompt with the changelog facts. SDK is the only consumer. Separate from the polish skill `changelog`.
_Avoid_: slash invocation, Claude skill, polish skill
