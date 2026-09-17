# sf-effect query adapter

Generated from `forcedotcom/sf-effect` commit `182db44ffb03d6cb27c433233df17763705034c1`.

The upstream package is private, unpublished, and uses Effect 4 beta. This bundle exposes its browser-safe Promise query boundary without exposing Effect 4 to this repository's Effect 3 dependency graph.

The build also prevents Effect 4 beta from passing VS Code web workers' invalid location URL as the base for absolute Salesforce URLs. The adapter accepts the caller's API version and access-token refresh function because the pinned SDK's token client does not yet expose either option.

`query` accepts the upstream Promise options plus Effect 3-derived record field paths. The bundle reconstructs an Effect 4 schema from those paths for structured-query field validation. Callers decode returned records with their Effect 3 schema.

Regenerate from the pinned checkout:

```sh
SF_EFFECT_PATH=/path/to/sf-effect npm run build -w @salesforce/sf-effect-sdk
```
