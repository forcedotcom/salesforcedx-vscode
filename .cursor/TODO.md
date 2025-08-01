# TODO

starting from zero, or resuming existing stored project
core PR/self-review
clean up /scripts/bundling folder for unused polyfills
is EMS-style `* from 'foo'` not ok? If not ok, block with a lint rule
should the fs stuff be its own extension that activates only in web scenario? If so, how to do that.
in the logs, it looks like workspaceService stuff is all running 2x
some Effect logging from the describe/list service

## docs

### effect, and specifically our "services" usage examples

- single layer no deps
- combining layers
- default "live" implementation

### how to run vscode-test-web

## CI

make sure web bundle runs on any changes

## jsforce

use a web-compatible solution for res.body.pipe and possibly the resulting stream type (to use web streams?)

test environment (see projectInit.setupCredentials)

go back to polyfill-puzzle [eliminate everything that can be removed from our polyfill mess but still allows the tests to pass]
see if there's anything we haven't done yet from "test-cleanup" puzzle that's worth doing
