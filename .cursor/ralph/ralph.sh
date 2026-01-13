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
"@.cursor/plans/e2e_tests_for_playwright_vscode_extension_a7c36853.plan.md @.cursor/ralph/progress.txt \
0. read this doc, remove any statements in progress.txt that contradict this script.\
0a. never edit this ralph.sh file.\
1.  Start with any existing failing (check local and lateste CI)\
 Decide what to change to address the failure.  Review past commits to make sure you are not repeating the same mistake.\
 If there are no failures, choose the next highest priority command\
1a. make sure output channel tests completely clear the output channel, there should not be text left in it.  Use screenshots to verify this.\
2. never change branches, stay on ralph-e2e-meta\
2a. you may not bypass eslint rules.
3. get it to run locally on test:web.  Web tests should never be skipped \
4. get it to run locally using the :desktop tests (the local environment is macos) \
5. makes sure org-browser tests are still passing locally (web and desktop) \
5a if failures locally, see the Debugging section of iterating-playwright-tests.mdc \
6. commit with a detailed commit message.  Be sure not to commit test artifacts from local or CI tests \
7. push to github \
8. monitor the e2e run see @.cursor/commands/analyze-e2e.md \
9. If failures, download logs/artifacts and update the progress.txt file \
9a. if failure is provably happening, you may change code in playwright ext to fix it.\
9b. If a commit made the result much worse, revert the commit and try somethinge else.\
10. once a test is passing on github actions, remove fallbacks, multieple clicks, waits, and <try another way> as long as they still pass on github actions \
10a. strive for minimum steps that will still pass locally and on all github actions \
10a. any changes between this branch and sm/deploy-commands should be questioned: was that really necessary?  The iterations may have introduced unnecessary changes. \
11. make sure code aligns with very carefully aligning with coding-playwright-tests.mdc rules and still passess. make sure the org-browser tests are still passing (they share the playwright ext) \
12. Append your progress to the progress.txt file. Do not make statements that are not supported by the code.\
13. If tests flap, update the plan to fix it. \
14b. remove from plan.md anything that is complete.  Complete means it passes locally and on github actions and aligns with the rules in coding-playwright-tests.mdc\
14. If, while implementing the feature, you notice that all work is complete, output <promise>COMPLETE</promise>. \
15. never exit unless complete.  do not disable tests or attempt to find ways to exit early.  You may not ask a question, only respond with <promise>COMPLETE</promise>\
")

  echo "$result"

  if [[ "$result" == *"<promise>COMPLETE</promise>"* ]]; then
    echo "PRD complete, exiting."
    exit 0
  fi
done
