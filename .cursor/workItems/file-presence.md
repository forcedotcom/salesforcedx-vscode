# file presence puzzle

in the org-browser extension,

in the orgBrowser, when creating TreeItem, I want to show one of 2 icons.
Icon 1 for "the metadata doesn't exist locally"
Icon 2 for "the metadata DOES exist locally"

So we need to translate from remote metadata type/name to a filename, then search vscode to see it it's there locally.

1. do not use `fs` api. Use vscode fs's api for findFiles
2. you can use SDR's registry to find what folder a file should be in, or what it's extension should be
3. you can use SDR's `filePathsFromMetadataComponent` to get a proposed filename

Propose the 2 best icons from vscode's icon set

Start with only the `component` type.
