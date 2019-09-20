# Common Errors

Here are common errors that you may run into while working with the local development server.

## Using an Unsupported Dependency

This error occurs when you use an unsupported Salesforce module. In this example, a user tries to import an unsupported dependency called userPermission: `import userPermission from '@salesforce/userPermission';`

![Image of Unsupported Dependency Error](../../images/localdev_error_dependency.png)

```
talon.js:3554 Uncaught Error: Unknown scope, cannot resolve dependency 'userPermission'
at assert$1 (talon.js:3554)
at Resolver.resolve (talon.js:10541)
at resolve (talon.js:11642)
at Resolver.resolve (talon.js:10542)
at ModuleRegistry.evaluateModuleDependency (talon.js:11818)
at talon.js:11770
at Array.map (<anonymous>)
at ModuleRegistry.resolveExports (talon.js:11765)
at ModuleRegistry.addModule (talon.js:11750)
at ModuleRegistry.define (talon.js:11719)
```
For more information about which modules the local development server supports, see Supported Salesforce Modules.

## Using a Nonexistent Component

This error message occurs when you try to use a component that isn't included in your local project or used globally. Here, the local development service cannot find the component `c-clockzzz`.

![Image of Nonexistent Component Error](../../images/localdev_error_component.png)

```
Uncaught Error: Could not resolve entry (c/clockzzz)
at error (:3333/Users/<path-to-workspace>/Dev/lwc-dev-server/node_modules/rollup/dist/rollup.js:3460)
at :3333/<path-to-workspace>/lwc-dev-server/node_modules/rollup/dist/rollup.js:21359
```

## Using a Component in a Nonexistent Namespace

If you use a namespace that either wasn't created in your org or that isn't part of the Component library, the local development server will produce this error.

![Image of Nonexistent Namespace Error](../../images/localdev_error_namespace.png)

```
talon.js:11847 Uncaught Error: Cannot resolve module 'force'
at ModuleRegistry.evaluateUnscopedModuleDependency (talon.js:11847)
at ModuleRegistry.evaluateModuleDependency (talon.js:11822)
at talon.js:11770
at Array.map (<anonymous>)
at ModuleRegistry.resolveExports (talon.js:11765)
at ModuleRegistry.addModule (talon.js:11750)
at ModuleRegistry.define (talon.js:11719)
at clock.js:1
```