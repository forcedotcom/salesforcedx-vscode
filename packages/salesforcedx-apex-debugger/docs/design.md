# Introduction

This is a document to explain some design choices in Apex Debugger extension for
VS Code.

# Breakpoint Lock

## Problem

VS Code sends a breakpoint request to a debugger adapter for each action that
updates a breakpoint per file. If a user enables breakpoints for lines 1, 2, 3
consecutively in the same file, the first request has a list with line 1, the
second request has a list with lines 1 and 2, the third request has a list with
lines 1, 2, and 3.

The adapter's breakpoint logic has async code that spawns a process to
communicate to Salesforce server. When that process begins, Nodejs event loop
moves on to the next breakpoint request. Even though Nodejs is single-threaded,
the adapter must be able to handle these breakpoints requests across multiple
event loops.

## Async-lock

The safest way to ensure we process each breakpoint action in order is to
prevent multiple breakpoint requests for one file. We opted to use async-lock
package to lock the setBreakpointsRequest method so only one request per file
can be processed. It's a small library with a specific goal, updated fairly
recently, and has some popularity.

### Queue

The lock can have multiple keys. A key is the URI of the file being processed.
This allows multiple files to be processed across event loops, but only one of
each file. The locking mechanism will queue breakpoint requests for a file that
is already being processed and has a default max queue of 1000. A typical user
could click fast enough to queue a few requests for one file, but unlikely to
reach the max queue.

### Timeout

The lock can have a timeout for how long pending requests should wait. If the
current request takes longer than the specified timeout, pending requests will
fail and respond to VS Code that no breakpoints were processed. The current
request will continue to completion and eventually give VS Code the list of
valid and invalid breakpoints.

To the user, a pending request is a grayed out unverified breakpoint, and will
still look the same when the request times out. Since there is no difference in
user experience, it may make the user queue more requests. We don't want to
build up this queue too high, so we use a low timeout.