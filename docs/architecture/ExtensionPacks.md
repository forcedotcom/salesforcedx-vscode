# Extension Packs

There are two extensions in this repo that are extension packs. These allow customers to install a set of extensions (from Salesforce and third parties) in one step.

## packages/salesforcedx-vscode (the standard pack)

the extensions from this repo plus

- code analyzer
- the vibe coding extension (Agentforce Vibes)
- vibes autocomplete
- metadata visualizer

## packages/salesforcedx-vscode-expanded

contains everything the standard pack plus some 3rd party extensions

- xml (Redhat, helps with lwc and metadata xml)
- prettier (formatting)
- log analyzer (Certinia, `financialforce.lana`)

`financialforce.lana` license:

```
BSD 3-Clause License

Copyright (c) 2020 Certinia Inc. All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
  list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
  this list of conditions and the following disclaimer in the documentation
  and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its
  contributors may be used to endorse or promote products derived from
  this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

---

Third-Party Licenses and Acknowledgments:

Tabulator Tables - https://github.com/olifolkerd/tabulator
Copyright (c) - Oli Folkerd
License: MIT

Tabulator is used under the terms of the MIT License. A copy of the license is available at:
https://opensource.org/licenses/MIT
```

## Inclusion Criteria

We don't have strict inclusion criteria.

## See Also

- [Extensions](./Extensions.md) - building extensions that could be included in packs
- [Build](../Build.md) - how to publish standalone extensions
