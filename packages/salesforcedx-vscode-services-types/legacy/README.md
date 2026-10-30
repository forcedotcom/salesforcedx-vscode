# Frozen V3 declarations

`services.d.ts` is the validated `dts-bundle-generator@9.5.1` output from the
services provider at `6e0c02183a16b590a227bac5bc7c1f41f764289e`, before V4 migration.
The redundant root `ICONS`/`IconId` declarations were removed from this snapshot;
the public entry still exports those unchanged from its generated icons module.
All service exports remain type-only.

Do not regenerate this contract from the migrated provider. Its Effect dependencies
and public signatures belong to the legacy V3 protocol. The build synchronizes only
the release version. Contract changes require the packed V3-only consumer gate.
