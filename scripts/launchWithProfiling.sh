#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: PROFILE_EXTENSIONS=extension1,extension2 ./scripts/launchWithProfiling.sh [--workspace <folder-or.code-workspace>] [VS Code arguments]

Profile selected development extensions from startup in VS Code.
PROFILE_EXTENSIONS is required and accepts comma-separated package directory names.
VSCODE_EXECUTABLE can override the stable VS Code app executable (for example, to use Insiders).
The workspace path may also be given as the first positional argument.
Press Enter in the terminal to save raw and source-mapped CPU profiles.

Options:
  --workspace PATH  Open a folder or .code-workspace file when profiling starts.
  -h, --help        Show this help.
EOF
}

for argument in "$@"; do
  if [[ "$argument" == --help || "$argument" == -h ]]; then
    usage
    exit 0
  fi
done

if [[ -z "${PROFILE_EXTENSIONS:-}" ]]; then
  echo "PROFILE_EXTENSIONS must name at least one development extension." >&2
  usage >&2
  exit 2
fi
if [[ "$PROFILE_EXTENSIONS" == ,* || "$PROFILE_EXTENSIONS" == *, || "$PROFILE_EXTENSIONS" == *,,* ]]; then
  echo "PROFILE_EXTENSIONS must be a comma-separated list without empty entries." >&2
  exit 2
fi

invocation_dir="$PWD"
workspace_input=""
case "${1:-}" in
  --workspace)
    if [[ $# -lt 2 || -z "$2" ]]; then
      usage >&2
      exit 2
    fi
    workspace_input="$2"
    shift 2
    ;;
  --workspace=*)
    workspace_input="${1#--workspace=}"
    if [[ -z "$workspace_input" ]]; then
      usage >&2
      exit 2
    fi
    shift
    ;;
  -* | '') ;;
  *)
    workspace_input="$1"
    shift
    ;;
esac

workspace_args=()
if [[ -n "$workspace_input" ]]; then
  if [[ "$workspace_input" != /* ]]; then
    workspace_input="$invocation_dir/$workspace_input"
  fi
  if [[ ! -d "$workspace_input" && ( ! -f "$workspace_input" || "$workspace_input" != *.code-workspace ) ]]; then
    echo "Workspace must be a folder or .code-workspace file: $workspace_input" >&2
    exit 2
  fi
  workspace_args+=("$(realpath "$workspace_input")")
fi

cd "$(dirname "${BASH_SOURCE[0]}")/.."

# Launch the app executable directly. The macOS shell CLI can hand arguments to
# an already-running instance, which keeps the previous development extensions.
code_executable="${VSCODE_EXECUTABLE:-/Applications/Visual Studio Code.app/Contents/MacOS/Code}"
if [[ ! -x "$code_executable" ]]; then
  echo "VS Code executable not found or not executable: $code_executable" >&2
  echo "Set VSCODE_EXECUTABLE to the application executable for your installation." >&2
  exit 1
fi

extension_names=(
  salesforcedx-vscode-visualforce
  salesforcedx-vscode-soql
  salesforcedx-vscode-lwc
  salesforcedx-vscode-lightning
  salesforcedx-vscode-core
  salesforcedx-vscode-services
  salesforcedx-vscode-org-browser
  salesforcedx-vscode-org
  salesforcedx-vscode-apex
  salesforcedx-vscode-metadata
  salesforcedx-vscode-apex-testing
  salesforcedx-vscode-apex-oas
  salesforcedx-vscode-apex-log
  salesforcedx-vscode-apex-replay-debugger
  salesforcedx-vscode-apex-debugger
)

IFS=',' read -r -a requested_extensions <<< "$PROFILE_EXTENSIONS"

extension_args=()
for extension in "${requested_extensions[@]}"; do
  if [[ ! " ${extension_names[*]} " == *" $extension "* ]]; then
    echo "Unknown extension in PROFILE_EXTENSIONS: $extension" >&2
    exit 1
  fi
  extension_args+=("--extensionDevelopmentPath=$PWD/packages/$extension")
done

DEBUG_BUNDLE=1 pnpm run vscode:bundle

profile_port="$(node -e 'const server = require("node:net").createServer(); server.listen(0, "127.0.0.1", () => { console.log(server.address().port); server.close(); });')"
profile_dir="$(mktemp -d /tmp/vscode-profile.XXXXXX)"
profile_file="$profile_dir/extHost.cpuprofile"
mkdir -p "$profile_dir/extensions"

echo "Starting VS Code with the extension host paused for profiling."
echo "Profile will be saved to: $profile_file"
echo "VS Code launch log: $profile_dir/vscode.stderr.log"

echo "Profiling ${#extension_args[@]} development extension(s): ${requested_extensions[*]}"
if [[ ${#workspace_args[@]} -gt 0 ]]; then
  echo "Opening workspace: ${workspace_args[0]}"
else
  echo "Open your chosen workspace in the new VS Code window after profiling starts."
fi
"$code_executable" --user-data-dir="$profile_dir/user-data" --extensions-dir="$profile_dir/extensions" \
  --inspect-brk-extensions="$profile_port" "${extension_args[@]}" "$@" "${workspace_args[@]}" \
  >"$profile_dir/vscode.stdout.log" 2>"$profile_dir/vscode.stderr.log" &
app_pid=$!

node scripts/profileExtensionHost.mjs "$profile_port" "$profile_file" "$app_pid"
node scripts/remapCpuProfile.mjs "$profile_file"
