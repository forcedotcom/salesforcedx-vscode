# MediaService

Icons and NLS descriptions for VS Code UI. V2 service access uses `Context.Service`.

`MediaService` is part of the shared V2 service graph; no per-extension layer is needed.

## Usage

### ICONS constant

Well-known icon IDs for VS Code UI strings. Use in labels: `` `${ICONS.SF_DEFAULT_ORG} label` ``

```typescript
const icons = yield* api.v2.services.MediaService;
// icons.ICONS.SF_DEFAULT_ORG → '$(sf-org-leaf)'
// icons.ICONS.SF_DEFAULT_HUB → '$(sf-org-tree)'
// icons.ICONS.ORG_TYPE_DEVHUB → '$(server)'
// icons.ICONS.ADD → '$(plus)'
// etc.
```

### getIconDescription

NLS-localized description for accessibility:

```typescript
const media = yield* api.v2.services.MediaService;
const desc = yield * media.getIconDescription(media.ICONS.SF_DEFAULT_ORG);
// → "Default Scratch Org" (localized)
```

## Direct import (non-Effect)

Extensions can import `ICONS` directly when not in Effect context:

```typescript
import { ICONS } from '@salesforce/vscode-services/v2';

label: `${ICONS.ADD} ${nls.localize('org_login_text')}`;
```

## Notes

- Custom icons (sf-org-leaf, sf-org-tree) contributed by services extension
- Others are built-in codicons (server, beaker, plus, etc.)
- Use `$(icon-id)` in VS Code UI strings for icon substitution
