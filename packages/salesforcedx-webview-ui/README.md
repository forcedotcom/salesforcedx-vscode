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

The gist of this approach is that we create HTML pages that contain React
components, and we expose them as panels inside VS Code.

# Architecture

```
┌────────────────────────────────────────────────────┐
│                                                    │
│   ┌───────────────────────────────────────────┐    │
│   │                                           │    │
│   │ ┌──────────────────┐ ┌──────────────────┐ │    │
│   │ │                  │ │                  │ │    │
│   │ │   Component #A   │ │   Component #B   │ │    │
│   │ │                  │ │                  │ │    │
│   │ │                  │ │                  │ │    │
│   │ └──────────────────┘ └──────────────────┘ │    │
│   │ ┌───────────────────────────────────────┐ │    │
│   │ │                                       │ │    │
│   │ │             Component #E              │ │    │
│   │ │                                       │ │    │
│   │ │                                       │ │    │
│   │ └───────────────────────────────────────┘ │    │
│   │                                           │    │
│   │                                           │    │
│   │                                           │    │                          ┌─────────────────────────┐
│   │                      ┌─────────────────┐  │    │      ┌───────────┐       │                         │
│   │                      │                 │  │    │      │postMessage│       │  ┌─────────────────┐    │
│   │                      │                 │  │  ──┼──────┴───────────┴───────┼▶ │                 │    │
│   │                      │ ┌─────────────┐ │  │    │                          │  │                 │    │
│   │                      │ │EventListener│ │  │    │                          │  │ ┌─────────────┐ │    │
│   │                      │ └─────────────┘ │  │    │                          │  │ │EventListener│ │    │
│   │                      │                 │  │    │                          │  │ └─────────────┘ │    │
│   │                      │                 │  │  ◀─┼──────┬───────────┬───────┼─ │                 │    │
│   │                             ◀──────────┘  │    │      │postMessage│       │  │                 │    │
│   │                                           │    │      └───────────┘       │         ◀──────────┘    │
│   └───────────────────────────────────────────┘    │                          │                         │
│                    HTML Page #1                    │                          │                         │
│                                                    │                          │                         │
└────────────────────────────────────────────────────┘                          │                         │
                   WebviewPanel #1                                              │                         │
                                                                                │                         │             ─
┌────────────────────────────────────────────────────┐                          │                         │
│                                                    │                          │                         │
│   ┌───────────────────────────────────────────┐    │                          │                         │     ┌────────────────┐
│   │                                           │    │                          │                        ◀┼─────▶      F/S       │
│   │ ┌──────────────────┐ ┌──────────────────┐ │    │                          │                         │     └────────────────┘
│   │ │                  │ │                  │ │    │                          │                         │     ┌────────────────┐
│   │ │   Component #B   │ │   Component #A   │ │    │                          │                        ◀┼─────▶      Web       │
│   │ │                  │ │                  │ │    │                          │                         │     └────────────────┘
│   │ │                  │ │                  │ │    │                          │                         │     ┌────────────────┐
│   │ └──────────────────┘ └──────────────────┘ │    │                          │                        ◀┼─────▶ Salesforce CLI │
│   │ ┌───────────────────────────────────────┐ │    │                          │                         │     └────────────────┘
│   │ │                                       │ │    │                          │                         │
│   │ │             Component #C              │ │    │                          │                         │
│   │ │                                       │ │    │                          │                         │
│   │ │                                       │ │    │                          │                         │
│   │ └───────────────────────────────────────┘ │    │                          │                         │
│   │                                           │    │                          │                         │
│   │                                           │    │                          │                         │
│   │                                           │    │                          │                         │
│   │                      ┌─────────────────┐  │    │                          │   ┌─────────────────┐   │
│   │                      │                 │  │    │      ┌───────────┐       │   │                 │   │
│   │                      │                 │  │    │      │postMessage│       │   │                 │   │
│   │                      │ ┌─────────────┐ │  │  ──┼──────┴───────────┴───────┼▶  │ ┌─────────────┐ │   │
│   │                      │ │EventListener│ │  │    │                          │   │ │EventListener│ │   │
│   │                      │ └─────────────┘ │  │    │                          │   │ └─────────────┘ │   │
│   │                      │                 │  │    │                          │   │                 │   │
│   │                      │                 │  │    │                          │   │                 │   │
│   │                             ◀──────────┘  │  ◀─┼──────┬───────────┬───────┼─         ◀──────────┘   │
│   │                                           │    │      │postMessage│       │                         │
│   └───────────────────────────────────────────┘    │      └───────────┘       │                         │
│                    HTML Page #2                    │                          └─────────────────────────┘
│                                                    │
└────────────────────────────────────────────────────┘                               VS Code Extension
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

# Third-party Libraries

* [react-script-ts](https://github.com/wmonk/create-react-app-typescript) - Provides the template for the project structure
* [create-react-app](https://github.com/facebook/create-react-app) - The basis for the project structure. Read this to understand how things work underneath.
* [Blueprint](http://blueprintjs.com/docs/v2/) - For UI components
* [Jest](https://facebook.github.io/jest/) - For testing

# Useful Reading

* [`<webview>` Tag](https://electronjs.org/docs/api/webview-tag)
* [Interop’s Labyrinth: Sharing Code Between Web & Electron Apps](https://slack.engineering/interops-labyrinth-sharing-code-between-web-electron-apps-f9474d62eccc)
* [Growing Pains: Migrating Slack’s Desktop App to BrowserView](https://slack.engineering/growing-pains-migrating-slacks-desktop-app-to-browserview-2759690d9c7b)

# Developer Flow

## Rapid Iteration of the UI

We need a way to rapidly iterate on the UI while we are prototyping. We
accomplish this via an in-memory web server that watches for changes to files
(on saves).

1. Invoke the Command Paletter in VS Code.
1. Type "task " (there is a space after task).
1. Select "Start salesforcedx-webview-ui"
1. This should open your default web browser to the main page.
1. Navigate to an entry point of your choice.

As you make edits, the web page should also refresh automatically. If there are
errors, you can see them in the Output panel in VS Code.

### Debugging

You can use the Chrome Developer with [React Developer
Tools](https://github.com/facebook/react-devtools) to debug. The in-memory web
server automatically includes the necessary source maps.

## Bundling the UI into VS Code

Once we are satisfied with our UI, we can bundle them into our VS Code
Extension. The bundled version has been minimized so that it loads more quickly.

1. Invoke the Command Palette in VS Code.
1. Type "task " (there is a space after task).
1. Select "Bundle salesforcedx-webview-ui"
1. This creates an optimized and minified build of your entry points and copies
   it into packages/salseforcedx-vscode-core/webviews.

Anytime you make changes and are ready to test them out in VS Code, be sure to
**repeat** those steps. We don't do this automatically since producing an
optimized and minimized build takes \~15 seconds and we don't want to do this
repeatedly on each save.


### Debugging

_This needs to be improved, the current debugging is quite difficult since we
ship minimized resources to optimize for load times_.

## Entry points

The convention is that each WebviewPanel will contain one HTML page. We call
this an entry point. Entry points are declared as follows:

1. Create a new folder in src/entries.
1. By convention, use a similar name to the name of the panel that you would expose in VS Code.
1. Add the necessary files to the new folder.
1. Be sure to add a new entry to config/paths.js

```javascript
///////////////////////////////////////
// Add the different entry points here
///////////////////////////////////////
const entries = ['ManifestEditor'];
```

## Testing the React Components

1. Invoke the Command Palette in VS Code.
1. Type "task " (there is a space after task).
1. Select "Test salesforcedx-webview-ui"

Tests should follow the convention of `some_name.test.ts`. This prevents the
tests from being bundled in the final optimized and minimized output.

For more information, see [create-react-app/Filename Conventions](https://github.com/facebook/create-react-app/blob/master/packages/react-scripts/template/README.md#filename-conventions)