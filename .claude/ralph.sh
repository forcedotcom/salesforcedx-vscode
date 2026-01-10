# ralph.sh
# Usage: ./ralph.sh <iterations>

set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <iterations>"
  exit 1
fi

# For each iteration, run Claude Code with the following prompt.
# This prompt is basic, we'll expand it later.
for ((i=1; i<=$1; i++)); do
  result=$(claude -p \
"@.cursor/plans/e2e-plan.md @.claude/progress.txt \
1. Decide which command to work next. \
This should be the one YOU decide has the highest priority, \
- not necessarily the first in the list. \
some may already exist and may or may not be passing. \
 Start with the ones that are not passing.\
2. never chagne branches, stay on sm/ralph-e2e-2
3. get it to run locally on test:web \
4. get it to run locally using the :desktop tests (the local environment is macos) \
5. makes sure org-browser tests are still passing locally (web and desktop) \
5a if there are failures locally, see the Debugging section of iterating-playwright-tests.mdc
6. commit with a detailed commit message \
7. push to github \
8. monitor the e2e run via gh cli \
9. If there are failures, download the logs/artifacts and update the progress.txt file \
10. once a test is passing on github actions, remove fallbacks, waits, and "try another way" as long as they still pass on github actions \
11. make sure code aligns with very carefully aligning with coding-playwright-tests.mdc rules and still passes3. make sure the org-browser tests are still passing (they share the playwright ext) \
12. Append your progress to the progress.txt file. \
13. If you are seeing test flakiness, update the plan to fix it. \
14. If, while implementing the feature, you notice that all work \
is complete, output <promise>COMPLETE</promise>. \
")

  echo "$result"

  if [[ "$result" == *"<promise>COMPLETE</promise>"* ]]; then
    echo "PRD complete, exiting."
    exit 0
  fi
done
