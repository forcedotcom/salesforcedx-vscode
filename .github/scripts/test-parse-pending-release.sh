#!/usr/bin/env bash
# Verification script for tagPendingRelease.yml regex parsing logic.
# Exercises the grep patterns against known PR body strings to validate
# that issue/discussion numbers are extracted correctly.
#
# Usage: bash .github/scripts/test-parse-pending-release.sh
# Exits 0 on success, 1 on failure with diff output.

set -euo pipefail

PASS=0
FAIL=0

# --- Helper ---
# Runs the same parse logic as the workflow and outputs three lines:
#   issues=<space-separated sorted numbers>
#   discussions=<space-separated sorted numbers>
#   unresolved=<space-separated sorted numbers>
parse_body() {
  local PR_BODY="$1"
  local REPO="$2"

  # Use perl for portability (macOS grep lacks -P; workflow runs on ubuntu where grep -P works)
  local ISSUE_NUMS
  ISSUE_NUMS=$(echo "$PR_BODY" | REPO="$REPO" perl -ne 'my $r = quotemeta($ENV{REPO}); while (/github\.com\/$r\/issues\/(\d+)/g) { print "$1\n" }' | sort -u | tr '\n' ' ' || true)

  local DISC_NUMS
  DISC_NUMS=$(echo "$PR_BODY" | REPO="$REPO" perl -ne 'my $r = quotemeta($ENV{REPO}); while (/github\.com\/$r\/discussions\/(\d+)/g) { print "$1\n" }' | sort -u | tr '\n' ' ' || true)

  local SHORT_REFS
  SHORT_REFS=$(echo "$PR_BODY" | perl -ne 'while (/(?:closes|close|fixes|fix|resolves|resolve)?\s*#(\d+)/gi) { print "$1\n" }' | sort -u | tr '\n' ' ' || true)

  local UNRESOLVED=""
  for NUM in $SHORT_REFS; do
    local ALREADY_KNOWN=false
    for I in $ISSUE_NUMS; do
      if [[ "$NUM" == "$I" ]]; then
        ALREADY_KNOWN=true
        break
      fi
    done
    if [[ "$ALREADY_KNOWN" == "false" ]]; then
      for D in $DISC_NUMS; do
        if [[ "$NUM" == "$D" ]]; then
          ALREADY_KNOWN=true
          break
        fi
      done
    fi
    if [[ "$ALREADY_KNOWN" == "false" ]]; then
      UNRESOLVED="$UNRESOLVED $NUM"
    fi
  done
  UNRESOLVED=$(echo "$UNRESOLVED" | xargs -n1 2>/dev/null | sort -u | tr '\n' ' ' || true)

  # Trim trailing whitespace
  ISSUE_NUMS=$(echo "$ISSUE_NUMS" | xargs)
  DISC_NUMS=$(echo "$DISC_NUMS" | xargs)
  UNRESOLVED=$(echo "$UNRESOLVED" | xargs)

  echo "issues=${ISSUE_NUMS}"
  echo "discussions=${DISC_NUMS}"
  echo "unresolved=${UNRESOLVED}"
}

assert_eq() {
  local test_name="$1"
  local expected="$2"
  local actual="$3"

  if [[ "$expected" == "$actual" ]]; then
    echo "PASS: $test_name"
    PASS=$((PASS + 1))
  else
    echo "FAIL: $test_name"
    echo "  expected: $expected"
    echo "  actual:   $actual"
    FAIL=$((FAIL + 1))
  fi
}

REPO="forcedotcom/salesforcedx-vscode"

# --- Test 1: Full issue URL ---
BODY="Fixed https://github.com/forcedotcom/salesforcedx-vscode/issues/123"
RESULT=$(parse_body "$BODY" "$REPO")
assert_eq "Full issue URL" "issues=123
discussions=
unresolved=" "$RESULT"

# --- Test 2: Full discussion URL ---
BODY="See https://github.com/forcedotcom/salesforcedx-vscode/discussions/456"
RESULT=$(parse_body "$BODY" "$REPO")
assert_eq "Full discussion URL" "issues=
discussions=456
unresolved=" "$RESULT"

# --- Test 3: Bare short ref ---
BODY="#789"
RESULT=$(parse_body "$BODY" "$REPO")
assert_eq "Bare short ref" "issues=
discussions=
unresolved=789" "$RESULT"

# --- Test 4: Keyword-prefixed short refs ---
BODY="Closes #100
Fixes #200
Resolves #300
fixes #400"
RESULT=$(parse_body "$BODY" "$REPO")
assert_eq "Keyword-prefixed short refs" "issues=
discussions=
unresolved=100 200 300 400" "$RESULT"

# --- Test 5: Mixed body with multiple refs ---
BODY="### What does this PR do?
Implements feature X.

### What issues does this PR fix or reference?
Closes #100, https://github.com/forcedotcom/salesforcedx-vscode/issues/200
Also see https://github.com/forcedotcom/salesforcedx-vscode/discussions/300

Some other text with no refs here."
RESULT=$(parse_body "$BODY" "$REPO")
assert_eq "Mixed body with multiple refs" "issues=200
discussions=300
unresolved=100" "$RESULT"

# --- Test 6: Body with no refs ---
BODY="This PR refactors the build system.
No issues or discussions linked."
RESULT=$(parse_body "$BODY" "$REPO")
assert_eq "Body with no refs" "issues=
discussions=
unresolved=" "$RESULT"

# --- Test 7: Refs to other repos (full URLs excluded, short refs included) ---
BODY="Related: https://github.com/other-org/other-repo/issues/999
Also fixes #50"
RESULT=$(parse_body "$BODY" "$REPO")
assert_eq "Other repo full URL excluded, short ref included" "issues=
discussions=
unresolved=50" "$RESULT"

# --- Test 8: Deduplication of full URL + short ref for same number ---
BODY="Fixes #123
https://github.com/forcedotcom/salesforcedx-vscode/issues/123"
RESULT=$(parse_body "$BODY" "$REPO")
assert_eq "Deduplicated full URL and short ref" "issues=123
discussions=
unresolved=" "$RESULT"

# --- Test 9: Close/Fix/Resolve singular forms ---
BODY="close #10
fix #20
resolve #30"
RESULT=$(parse_body "$BODY" "$REPO")
assert_eq "Singular keyword forms" "issues=
discussions=
unresolved=10 20 30" "$RESULT"

# --- Test 10: Discussion URL deduplication with short ref ---
BODY="https://github.com/forcedotcom/salesforcedx-vscode/discussions/456
#456"
RESULT=$(parse_body "$BODY" "$REPO")
assert_eq "Discussion URL dedup with short ref" "issues=
discussions=456
unresolved=" "$RESULT"

# --- Summary ---
echo ""
echo "Results: ${PASS} passed, ${FAIL} failed"

if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
