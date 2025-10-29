# Virtual Filesystem Provider

on the web, we don't have local fs. So we're going to use memfs as an in-memory fs with an API exactly like `node:fs` and `graceful-fs`.

It doesn't have persistence, so we need to write transactions to browser storage (IndexDB).

## Big picture

```mermaid
graph TD
    A["VS Code UI<br/>(File Explorer, Editor, etc.)"]
    B["FileSystemProvider<br/>(FsProvider implements<br/>vscode.FileSystemProvider)"]
    C["memfs<br/>(In-memory file system with<br/>Node.js fs API compatibility)"]
    D["memfsWatcher<br/>(Watches memfs for changes and<br/>triggers persistence operations)"]
    E["IndexedDB<br/>(Browser persistent storage<br/>for file system state,<br/>one key/value<br/>per file/directory)"]

    A <--> |"onDidChange"| B
    B <--> |"Node.js-like fs API calls<br/>(fs.readFile, fs.writeFile, etc.)"| C
    C --> |"File change in memfs cause events<br/>(rename, change)"| D
    D --> |"Persistence operations<br/>(save, load, delete)"| E
```

### Component Responsibilities:

- **VS Code UI**: User interface for file operations (Explorer, Editor)
- **FileSystemProvider**: VS Code API implementation that bridges UI to file system
- **memfs**: In-memory file system providing Node.js fs API compatibility
- **memfsWatcher**: Monitors file changes and triggers persistence to browser storage
- **IndexedDB**: Browser persistent storage ensuring data survives page reloads

## Example data flows

### User edits a file

Every change by the user generates a VSCode onDidChange event. We want to alway write every change to memfs so the user doesn't have to save files manually (think google docs, not old-school Word)

The change flows from top to bottom:

```mermaid
graph TD
    A["User types a character<br/>in vscode editor"]
    B["FileSystemProvider<br/>(updates memfs)"]
    C["memfsWatcher<br/>(Detects file system change)"]
    D["IndexedDB<br/>(File persisted to<br/>browser storage)"]

    A --> |"onDidChange event"| B
    B --> |"File change event<br/>(rename/change)"| C
    C --> |"Persistence operation<br/>(saveFile call)"| D
```

### Rehydrating the project

When the project loads, we need to populate everything from indexDB into memfs and then hook that into fsp for vscode.

[it's the same diagram as "edit a file" but arrows start athe bottom and go upward.]

When there aren't fils in the browser storage, the Extension activate function will write them to memfs. The flow is similar to what SDR does in the next example.

### Some process edits a file directly in mems

the CLI libraries now use an `fs` module from sfdx-core. It **could** be memfs, or regular `node:fs`. This allows **any other process** (ex: SDR retrieve) to edit memfs directly and have those changes flow "upward" to the vscode UI and down to browser storage

```mermaid
graph TD
    A["VS Code UI"]
    B["FileSystemProvider"]

    subgraph side [" "]
        direction LR
        F["SDR Retrieve<br/>(CLI process using<br/>sfdx-core fs module)"]
        C["memfs"]
    end

    D["memfsWatcher"]
    E["IndexedDB"]

    C --> |"memfs to FSP"| B
    B --> |"onDidChange"| A
    F --> |"Direct fs operations<br/>(retrieve files)"| C
    C --> |"File change events"| D
    D --> |"Persistence operations<br/>(save, load, delete)"| E
```
