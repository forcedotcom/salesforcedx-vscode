# Execute CodeLens from Apex Log, not Jorje

Jorje emits Execute (`sf.anon.apex.run.delegate`) and Debug on Anonymous Apex. Web has no Jorje. Apex Log owns Execute on `apex-anon`: extension CodeLens → `sf.anon.apex.execute.document`. Desktop Apex `provideCodeLenses` middleware drops the LS Execute lens so desktop is not duplicated. Debug and `debug.delegate` stay LS-owned. Handler for `run.delegate` deleted — a leftover lens is a dead click (swallow regression), not a silent second Execute.

**Considered:** change Jorje (LS+extension release); keep `run.delegate` as backstop (hides duplicate-lens regression); Apex Log lens on `apex` as well (out of scope).
