| Event | Effect on test results |
|-------|----------------------|
| **Deploy a test class** | All methods in that class are marked `@stale` and dimmed — code changed since last run. |
| **Run the test** | `@stale` tag removed, icon returns to full brightness. |
| **Re-run Stale profiles** | Runs only methods still tagged `@stale`, skipping tests that are already current. |

This happens automatically on deploy — no manual refresh needed.

![Stale test run profiles](stale-test-run-profiles.png)
