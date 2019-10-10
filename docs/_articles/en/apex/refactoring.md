---
title: Apex Refactoring
lang: en
---

## Refactor: Rename

You can rename any valid Apex symbol defined in your source: methods, locals, fields, properties, constructors, or types (classes, triggers, or enums). To perform a rename, right-click the symbol that you want to rename and select **Rename Symbol**.

![GIF showing the symbol renaming process](./images/apex-rename-demo.gif)

Validation of the new symbol name is performed before applying the rename. If the validation fails, an error message explains the reason why the rename refactoring could not be applied. Validation fails if the new name is not a valid Apex identifier or, sometimes, if the new name conflicts with an existing identifier name. (If these situations were allowed, a compiler error or a runtime behavior change could result.)

![GIF showing a renaming error](./images/apex-rename-error.gif)

If the new name conflicts with an existing identifier name, we try to fully qualify the references to the existing name in contexts where the conflicts exist.

![GIF showing a renaming conflict](./images/apex-rename-conflict.gif)

## Refactor: Extract Constant

You can extract literals into constants. Literals include: String, Integer, Long, Double, Decimal, and Boolean.

1. In the editor, select an expression that you would like to extract.
1. Click the lightbulb in the gutter and select 'Extract Constant'.
1. The new constant will be declared as a field in the containing class from where the refactoring was invoked.
1. The selected expression should now be replaced with the name of the new field.

![GIF showing extract constant](./images/extract-constant.gif)

## Refactor: Extract Local Variable

You can extract expressions into local variables.

1. In the editor, select an expression that you would like to extract.
1. Click the lightbulb in the gutter and select 'Extract Variable'.
1. The new local variable will be declared in the line above the declaration where the refactoring was invoked.
1. The selected expression should now be replaced with the name of the new local variable.

![GIF showing extract local variable other](./images/extract-local-variable-other.gif)
