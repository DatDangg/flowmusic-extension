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

## 2026-05-23 Requested Updates

- Removed the advanced settings section from `popup.html` and removed popup handlers that depended on those controls.
- Changed the max music generation wait default from 180 seconds to 300 seconds in `popup.html`, `popup.js`, and `content.js`.
- Kept the side panel enabled only on FlowMusic tabs in `background.js`.
- Disabled automatic side-panel opening on action click, so clicking the extension from another tab shows the FlowMusic confirm instead of opening the popup there.
- Fixed FlowMusic tab opening by calling `chrome.sidePanel.open()` directly from the extension click path without awaiting side-panel option setup first.
- After the user accepts the FlowMusic confirm from another tab, the extension now creates the FlowMusic tab and immediately opens the side panel there.
- Moved the FlowMusic tab creation and side-panel open call into `confirm.js` so the confirm window button click preserves the user gesture required by Chrome.
- Updated Stop handling in `popup.js` and `content.js` so stopping reports `Đã dừng` and does not fall through to the timeout/continue message.
- Reformatted popup debug logs into timestamped rows with better spacing, wrapping, and empty-state text.

Verification:

- `node --check popup.js`
- `node --check content.js`
- `node --check background.js`
- `manifest.json` parsed successfully as JSON.
