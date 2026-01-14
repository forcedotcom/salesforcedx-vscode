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
  result=$(agent --force -p \
"@..cursor/plans/simplify_playwright_test_helpers_420ec698.plan.md @.cursor/ralph/progress.txt \
0a. never edit this ralph.sh file.\
1.  Review past commits and the plan to make sure you are not repeating the same mistake.\
 If there are no failures, choose the next highest priority item\
 only work on one item at a time, all the way through CI results.\
 if a large simplificaiton doesn't work, try doing it in pieces.
2. never change branches, stay on ralph-e2e-meta\
2a. you may not bypass eslint rules.\
5c. make sure code aligns with with coding-playwright-tests.mdc rules and still passess. make sure the org-browser tests are still passing (they share the playwright ext) \
3. must pass locally on test:web.  Web tests should never be skipped \
4. must pass locally using the :desktop tests (the local environment is macos) \
5. makes sure org-browser tests are still passing locally\
  web [npm run test:web -w salesforcedx-vscode-org-browser] \
  desktop [npm run test:desktop -w salesforcedx-vscode-org-browser] \
5a if failures locally, see the Debugging section of iterating-playwright-tests.mdc \
7. only if e2e tests are passing locally (desktopa and web, including org-browser) \
  commit with a detailed commit message. don't commit test artifacts from local or CI tests.  say (ralph) in the commit message. \
  push to github \
8. must pass in github actions! \
  You cannot continue until the e2e run has completed and is passing for mac, windows, and web.\
  monitor the e2e run see @.cursor/commands/analyze-e2e.md for how to do it.\
  It will take a long time, be patient \
  Do not make any other code changes until the e2e is passing.
  Seriously, be sure the e2e run completed before doing anything else.
12. Append your progress to the progress.txt file.\
13. Any test failures (locally or on CI) are caused by your change, there were no pre-existing failures.
  DO NOT EXIT if there are test failures.
  If a commit causes an error, revert the commit and try somethinge else.\
  for any failures (locally or on CI) caused by the change, indicate on the plan.md file that that code cannot be simplified in that way\
14. If all tasks are complete and the last CI run is passing on all platforms, output <promise>COMPLETE</promise>. \
15. never exit unless complete and all tests are passing on all platforms locally and on CI. \
16. Do not disable tests or attempt to find ways to exit early. \
17. You may not ask a question, only respond with <promise>COMPLETE</promise> when all work is done, or marked as impossible AND all github actions CI is passing \
")

  echo "$result"

  if [[ "$result" == *"<promise>COMPLETE</promise>"* ]]; then
    echo "PRD complete, exiting."
    exit 0
  fi
done
