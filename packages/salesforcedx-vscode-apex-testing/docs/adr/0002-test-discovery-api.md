# Discover Apex tests via the org's Tooling Test Discovery API, not an Apex LS (Jorje) workspace scan

- was: Jorje workspace discovery (local Apex LS project scan)
- now: org-based Tooling REST Test Discovery API (`>= v65.0`); requires live org connection

Consequence:

- runnable = tests discovered in the org
- undeployed project classes absent from tree until deployed (org-discovery consequence; no in-code deploy gate)

Trade-off:

- discovery needs live org connection — no offline tree
