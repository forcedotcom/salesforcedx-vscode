# Introduction

This package contains React web components that we use in our Webview panels for
VS Code.

In general, VS Code doesn't support arbitrary manipulations to its UI via the
DOM. This is documented at its [Extensibility Principles and
Patterns](https://code.visualstudio.com/docs/extensionAPI/patterns-and-principles#_extensibility-api)
page.

However, there are times when we do need to provide our own custom UI within VS
Code. Fortunately, VS Code 1.23 and above provide for this via the [VS Code
WebView API](https://code.visualstudio.com/docs/extensions/webview)

The gist of this approach is that we create HTML pages that contain LWC
components, and we expose them as panels inside VS Code.

# Architecture

```
+----------------------------------------------------+
|                                                    |
|   +-------------------------------------------+    |
|   |                                           |    |
|   | +------------------+ +------------------+ |    |
|   | |                  | |                  | |    |
|   | |   Component #A   | |   Component #B   | |    |
|   | |                  | |                  | |    |
|   | |                  | |                  | |    |
|   | +------------------+ +------------------+ |    |
|   | +---------------------------------------+ |    |
|   | |                                       | |    |
|   | |             Component #E              | |    |
|   | |                                       | |    |
|   | |                                       | |    |
|   | +---------------------------------------+ |    |
|   |                                           |    |
|   |                                           |    |
|   |                                           |    |                          +-------------------------+
|   |                      +-----------------+  |    |      +-----------+       |                         |
|   |                      |                 |  |    |      |postMessage|       |  +-----------------+    |
|   |                      |                 |  |  --+------+-----------+-------+> |                 |    |
|   |                      | +-------------+ |  |    |                          |  |                 |    |
|   |                      | |EventListener| |  |    |                          |  | +-------------+ |    |
|   |                      | +-------------+ |  |    |                          |  | |EventListener| |    |
|   |                      |                 |  |    |                          |  | +-------------+ |    |
|   |                      |                 |  |  <-+------+-----------+-------+- |                 |    |
|   |                             <----------+  |    |      |postMessage|       |  |                 |    |
|   |                                           |    |      +-----------+       |         <----------+    |
|   +-------------------------------------------+    |                          |                         |
|                    HTML Page #1                    |                          |                         |
|                                                    |                          |                         |
+----------------------------------------------------+                          |                         |
                   WebviewPanel #1                                              |                         |
                                                                                |                         |             -
+----------------------------------------------------+                          |                         |
|                                                    |                          |                         |
|   +-------------------------------------------+    |                          |                         |     +----------------+
|   |                                           |    |                          |                        <+----->      F/S       |
|   | +------------------+ +------------------+ |    |                          |                         |     +----------------+
|   | |                  | |                  | |    |                          |                         |     +----------------+
|   | |   Component #B   | |   Component #A   | |    |                          |                        <+----->      Web       |
|   | |                  | |                  | |    |                          |                         |     +----------------+
|   | |                  | |                  | |    |                          |                         |     +----------------+
|   | +------------------+ +------------------+ |    |                          |                        <+-----> Salesforce CLI |
|   | +---------------------------------------+ |    |                          |                         |     +----------------+
|   | |                                       | |    |                          |                         |
|   | |             Component #C              | |    |                          |                         |
|   | |                                       | |    |                          |                         |
|   | |                                       | |    |                          |                         |
|   | +---------------------------------------+ |    |                          |                         |
|   |                                           |    |                          |                         |
|   |                                           |    |                          |                         |
|   |                                           |    |                          |                         |
|   |                      +-----------------+  |    |                          |   +-----------------+   |
|   |                      |                 |  |    |      +-----------+       |   |                 |   |
|   |                      |                 |  |    |      |postMessage|       |   |                 |   |
|   |                      | +-------------+ |  |  --+------+-----------+-------+>  | +-------------+ |   |
|   |                      | |EventListener| |  |    |                          |   | |EventListener| |   |
|   |                      | +-------------+ |  |    |                          |   | +-------------+ |   |
|   |                      |                 |  |    |                          |   |                 |   |
|   |                      |                 |  |    |                          |   |                 |   |
|   |                             <----------+  |  <-+------+-----------+-------+-         <----------+   |
|   |                                           |    |      |postMessage|       |                         |
|   +-------------------------------------------+    |      +-----------+       |                         |
|                    HTML Page #2                    |                          +-------------------------+
|                                                    |
+----------------------------------------------------+                               VS Code Extension
                   WebviewPanel #2

Created with Monodraw
```

We can embed an HTML page that contains our components into a WebviewPanel.
Those components can communicate with the VS Code Extension via message passing.
Similarly, the VS Code Extension can communicate with the WebviewPanel via
message passing. The communication protocol is up to the implementor.

There is no limit on the number of WebviewPanels that we can embed. However,
since each one WebviewPanel is backed by an Electron WebView, which runs in its
own process, there could be performance penalties.

# Useful Reading

- [`<webview>` Tag](https://electronjs.org/docs/api/webview-tag)
- [Interop’s Labyrinth: Sharing Code Between Web & Electron Apps](https://slack.engineering/interops-labyrinth-sharing-code-between-web-electron-apps-f9474d62eccc)
- [Growing Pains: Migrating Slack’s Desktop App to BrowserView](https://slack.engineering/growing-pains-migrating-slacks-desktop-app-to-browserview-2759690d9c7b)
