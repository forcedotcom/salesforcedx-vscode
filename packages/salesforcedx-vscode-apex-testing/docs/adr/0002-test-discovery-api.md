# Discover Apex tests via the org's Tooling Test Discovery API, not an Apex LS (Jorje) workspace scan

Was: Jorje workspace discovery — tests sourced from the local Apex language server's project scan. Now (2025/2026): the org-based Tooling REST Test Discovery API (`>= v65.0`), keyed on a live org connection.

Consequence: runnable = tests discovered in the org. Undeployed project classes are absent from the org, so they don't appear in the tree until deployed — an org-discovery consequence, not an enforced deploy step (no in-code deploy gate).

Trade-off: discovery needs a live org connection — no offline tree.
