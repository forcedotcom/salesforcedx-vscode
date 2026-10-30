# V4 services implementation staging

This private package contains the migrated service implementations while the
services extension still runs its V3 production graph. It uses ordinary Effect
4.0.6 and the canonical keys from `@salesforce/vscode-services-v2`.

`foundationalLayers` and `foundationalWatcherLayers` are stable layer values, not
runtime factories. Later migration slices must compose those same values so
caches, references and watchers remain shared. The host supplies the existing web
filesystem provider getter and, for watcher startup messages, V4 ChannelService.

W-24615069 moves these implementations into the provider and removes this temporary
package and the superseded V3 implementations. Do not activate a second production
graph. See [the architecture contract](../../docs/architecture/effect-v4-foundations.md)
for ownership, platform behavior and verification boundaries.
