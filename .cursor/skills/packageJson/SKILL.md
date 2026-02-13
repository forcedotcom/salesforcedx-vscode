---
name: packageJson
description: Guidelines for package.json files in packages
---

packages should not duplicate devDependencies that exist at the top level of the repo.

packages that publish to npm should have a `files` property in the package.json
