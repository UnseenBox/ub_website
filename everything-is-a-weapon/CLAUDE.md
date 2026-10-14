# Token-Efficient Development Rules

## Scope

* Make the smallest correct change that solves the requested task.
* Do not redesign, refactor, or audit unrelated code.
* Start with explicitly named files and symbols. Search the wider project only when necessary.
* Before editing, identify the target files. Expand the scope only if a real dependency requires it.

## File Reading

* Never scan the entire repository without a specific reason.
* Do not read node_modules, .next, dist, build, coverage, generated files, lockfiles, or large assets unless the task requires them.
* Never dump entire large source files, logs, or assets into the conversation when a relevant function or excerpt is sufficient.
* Refer to functions, components, and line ranges instead of repeatedly reading the same files.
* Do not attach or include the same file contents more than once unless they have changed or need to be re-examined.

## Commands and Tests

* Run the smallest relevant test first.
* Prefer quiet or concise test reporters.
* Do not run the full test suite or full build repeatedly after every small change.
* Capture long command output in a log file and report errors, the exit code, and the relevant final lines.
* Reuse the result of a successful test unless code changes make it necessary to rerun.

## Implementation

* No unrelated file changes, dependency installation, broad rewrites, or speculative fixes.
* Avoid repeated exploratory tool calls. Use targeted search before opening files.
* If a command or approach fails, use the error to adjust the next attempt instead of repeating it unchanged.

## Response

* Do not narrate every tool call or repeat the plan after every step.
* Do not print full files or large diffs unless requested.
* Report only the files changed, the important implementation details, the tests run, and any remaining issue.
* Keep the final report under 5 concise bullets.

## Compact Instructions

When compacting, preserve the current objective, relevant file paths, decisions, changes made, test results, known blockers, and the next concrete action. Discard unrelated exploration and obsolete logs.
