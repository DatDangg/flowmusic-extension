# FlowMusic Extension Task Status

Updated: 2026-05-23

## Done

- Task 1: Fix Vietnamese Encoding
  - Rewrote `manifest.json`, `popup.html`, `popup.js`, and `content.js` as proper UTF-8.
  - Fixed Vietnamese labels, popup messages, status logs, and manifest description.

- Task 2: Fix `runState` Persistence
  - Saves running state, current prompt index, and start time when automation starts.
  - Updates saved progress from content-script status messages.
  - Clears stale running state on stop, finish, failure, and reset.

- Task 3: Handle `chrome.tabs.sendMessage()` Errors
  - Centralized tab message handling with `chrome.runtime.lastError` checks.
  - Shows clear popup errors when FlowMusic/content script is not ready.

- Task 4: Tighten Loading Selectors
  - Uses specific loading/generating/spinner/skeleton/progress selectors.
  - Keeps manual loading selector override.

- Task 5: Use Done Detection
  - Counts result/audio/song/player indicators before submit.
  - Advances only after a new visible result appears and loading is no longer active, or after timeout.

- Task 6: Improve Submit Button Detection
  - Scores submit candidates by label, attributes, icon hints, and proximity to the input.
  - Ignores disabled, hidden, and negative-action buttons before Enter fallback.

- Task 7: Improve Prompt Input Handling
  - Supports `textarea`, `input`, `contenteditable`, and generic textboxes.
  - Uses native value setters plus `beforeinput`, `input`, and `change` events for React-like UIs.
  - Avoids per-character keyboard events unless value setting fails.

- Task 8: Add Prompt File Validation
  - Validates `.txt` content and empty files.
  - Warns on large prompt lists and very long lines.
  - Removes duplicate prompts and handles file read errors.

- Task 9: Add Resume and Reset Controls
  - Added separate controls for continuing, restarting from prompt 1, and resetting progress.
  - Keeps current progress visible in the list and progress bar.

- Task 10: Add Debug Mode
  - Added debug checkbox and recent debug log panel in the popup.
  - Logs input selector, submit selector, loading checks, done detection, and message errors.
  - Stores recent debug logs in `chrome.storage.local`.

## Verification

- `node --check popup.js`
- `node --check content.js`
- `manifest.json` parsed successfully as JSON.
- Mojibake scan found no broken encoding in extension source files; only normal Vietnamese/emoji characters remain.
