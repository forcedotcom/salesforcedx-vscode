# Execute CodeLens from Apex Log, not Jorje

Jorje emits Execute (`sf.anon.apex.run.delegate`) and Debug on Anonymous Apex. Web lacks Jorje. Apex Log owns Execute on `apex-anon` via CodeLens → `sf.anon.apex.execute.document`. Desktop Apex middleware drops LS Execute lens to prevent duplication. Debug and `debug.delegate` remain LS-owned. Handler for `run.delegate` deleted—leftover lenses become dead clicks (swallow regression vs silent duplicate Execute).

**Considered**: change Jorje (LS+extension release); keep `run.delegate` as backstop (hides duplicate-lens regression); Apex Log lens on `apex` as well (out of scope).
