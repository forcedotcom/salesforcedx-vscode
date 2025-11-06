#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get current branch
BRANCH=$(git branch --show-current)

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Windows CI Iteration Loop${NC}"
echo -e "${BLUE}Branch: ${BRANCH}${NC}"
echo -e "${BLUE}========================================${NC}"
echo

# Step 1: Run local e2e tests
echo -e "${YELLOW}Step 1: Running local e2e tests...${NC}"
echo "Command: npm run test:desktop:ci -w salesforcedx-vscode-org-browser -- --retries 0"
echo

if npm run test:desktop:ci -w salesforcedx-vscode-org-browser -- --retries 0; then
  echo -e "${GREEN}✓ Local e2e tests passed${NC}"
  echo
else
  echo -e "${RED}✗ Local e2e tests failed${NC}"
  echo -e "${RED}Fix the failures before committing and pushing${NC}"
  exit 1
fi

# Step 2: Commit changes
echo -e "${YELLOW}Step 2: Committing changes...${NC}"
TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")
COMMIT_MSG="ci: iterate on Windows CI fixes - ${TIMESTAMP}"

git add -A
if git diff --cached --quiet; then
  echo -e "${YELLOW}No changes to commit${NC}"
else
  git commit -m "${COMMIT_MSG}"
  echo -e "${GREEN}✓ Committed: ${COMMIT_MSG}${NC}"
fi
echo

# Step 3: Push to branch
echo -e "${YELLOW}Step 3: Pushing to ${BRANCH}...${NC}"
git push origin "${BRANCH}"
echo -e "${GREEN}✓ Pushed to origin/${BRANCH}${NC}"
echo

# Step 4: Trigger workflow
echo -e "${YELLOW}Step 4: Triggering orgBrowserE2E workflow...${NC}"
gh workflow run orgBrowserE2E.yml --ref "${BRANCH}"
echo -e "${GREEN}✓ Workflow triggered${NC}"
echo

# Wait a moment for the run to be created
sleep 5

# Step 5: Get the latest run ID for this branch
echo -e "${YELLOW}Step 5: Finding workflow run...${NC}"
RUN_ID=$(gh run list --workflow=orgBrowserE2E.yml --branch="${BRANCH}" --limit=1 --json databaseId --jq='.[0].databaseId')

if [ -z "$RUN_ID" ]; then
  echo -e "${RED}✗ Could not find workflow run${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Found run ID: ${RUN_ID}${NC}"
echo -e "${BLUE}View run at: https://github.com/forcedotcom/salesforcedx-vscode/actions/runs/${RUN_ID}${NC}"
echo

# Step 6: Watch the run
echo -e "${YELLOW}Step 6: Watching workflow run (this may take several minutes)...${NC}"
if gh run watch "${RUN_ID}"; then
  echo -e "${GREEN}✓ Workflow completed successfully${NC}"
  SUCCESS=true
else
  echo -e "${RED}✗ Workflow failed or was cancelled${NC}"
  SUCCESS=false
fi
echo

# Step 7: Get logs and analyze
echo -e "${YELLOW}Step 7: Analyzing logs...${NC}"
echo

# Get the run view output
LOGS=$(gh run view "${RUN_ID}" --log 2>&1)

# Check for screenshot errors
SCREENSHOT_ERRORS=$(echo "$LOGS" | grep -c "Failed to save screenshot" || true)
if [ "$SCREENSHOT_ERRORS" -gt 0 ]; then
  echo -e "${RED}Found ${SCREENSHOT_ERRORS} screenshot errors:${NC}"
  echo "$LOGS" | grep "Failed to save screenshot" | head -5
  echo
fi

# Check for aria snapshot failures
ARIA_ERRORS=$(echo "$LOGS" | grep -c "toMatchAriaSnapshot" || true)
if [ "$ARIA_ERRORS" -gt 0 ]; then
  echo -e "${RED}Found aria snapshot failures:${NC}"
  echo "$LOGS" | grep -A 10 "toMatchAriaSnapshot" | head -30
  echo
fi

# Check for test failures
TEST_FAILURES=$(echo "$LOGS" | grep -c "failed" || true)
if [ "$TEST_FAILURES" -gt 0 ]; then
  echo -e "${RED}Found test failures:${NC}"
  echo "$LOGS" | grep -i "failed" | head -10
  echo
fi

# Summary
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Summary${NC}"
echo -e "${BLUE}========================================${NC}"

if [ "$SUCCESS" = true ]; then
  echo -e "${GREEN}✓ CI run completed successfully${NC}"
  echo -e "${GREEN}✓ All tests passed on Windows${NC}"
  echo
  echo -e "${BLUE}Next steps:${NC}"
  echo "  - Review the test results"
  echo "  - If there are new platform-specific snapshots, they will be in the artifacts"
else
  echo -e "${RED}✗ CI run failed${NC}"
  echo
  echo -e "${BLUE}Next steps:${NC}"
  echo "  1. Review the errors above"
  echo "  2. Make necessary fixes"
  echo "  3. Run this script again"
  echo
  echo "  View full logs:"
  echo "  gh run view ${RUN_ID} --log"
  echo
  echo "  Download artifacts:"
  echo "  gh run download ${RUN_ID}"
fi

echo
echo -e "${BLUE}Run URL: https://github.com/forcedotcom/salesforcedx-vscode/actions/runs/${RUN_ID}${NC}"

