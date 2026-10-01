| Visual state | Meaning |
|-------------|---------|
| **Bright** pass/fail icon | Test was run during this IDE session — result is current. |
| **Dimmed** pass/fail icon | Result was restored from a previous session — code may have changed since. |
| `@stale` tag | Filterable marker on outdated results. Use `@stale` in the filter box or the **Re-run Stale** profiles. |

**Refresh** re-discovers tests from the org and restores results. Tests run this session stay bright; older results are dimmed.

![Restored tree with session-active test](restored-tree-with-seesion-active-test.png)
