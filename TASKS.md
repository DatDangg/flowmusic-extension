# FlowMusic Extension Fix & Update Tasks

## Task 1: Fix Vietnamese Encoding

Files:
- `manifest.json`
- `popup.html`
- `popup.js`
- `content.js`

Work:
- Convert all files to proper UTF-8.
- Fix broken Vietnamese text such as `Tá»± Ä‘á»™ng`.
- Recheck all popup labels, status logs, and manifest description.

Done when:
- Vietnamese text displays correctly in Chrome popup.
- Console/source files no longer show mojibake text.

## Task 2: Fix `runState` Persistence

File:
- `popup.js`

Problem:
- The popup reads `runState`, but the code does not write it consistently.

Work:
- When starting automation, save:
  - `running: true`
  - `currentIndex`
  - `startedAt`
- When receiving progress from content script, update `runState.currentIndex`.
- When stopping, finishing, or failing, save `running: false`.

Done when:
- Reopening the popup while automation is running shows the correct running UI.
- Stop/done/error states do not leave stale running state behind.

## Task 3: Handle `chrome.tabs.sendMessage()` Errors

File:
- `popup.js`

Locations:
- Start automation message
- Stop automation message
- Detect selectors message

Work:
- Wrap message calls with proper error handling.
- Check `chrome.runtime.lastError`.
- Show a clear popup log if the content script is not available.

Done when:
- If FlowMusic tab is not ready, the user sees a clear error instead of silent failure.

## Task 4: Tighten Loading Selectors

File:
- `content.js`

Problem:
- Selectors like `[class*="animate"]` are too broad and may match unrelated animations.

Work:
- Remove or reduce broad loading selectors.
- Prefer specific FlowMusic loading indicators.
- Keep custom loading selector support for manual override.

Done when:
- The extension no longer waits forever because of unrelated animated elements.
- Timeout happens only when generation is actually stuck or selectors are wrong.

## Task 5: Use Done Detection

File:
- `content.js`

Problem:
- `DONE_SELECTORS` exists but is not used.

Work:
- Add an `isDone()` helper.
- Before submitting a prompt, record current result count.
- After loading disappears, confirm that a new result/audio/song card appears.

Done when:
- The script advances only after a new generated item is detected, or timeout is reached.

## Task 6: Improve Submit Button Detection

File:
- `content.js`

Problem:
- `button:has(svg)` may match the wrong button.

Work:
- Prefer buttons with labels/text related to send, submit, generate, or create.
- Prefer the button closest to the prompt input.
- Ignore disabled or hidden buttons.
- Use Enter key only as a fallback.

Done when:
- The script reliably submits from the correct FlowMusic input area.

## Task 7: Improve Prompt Input Handling

File:
- `content.js`

Work:
- Test and support:
  - `textarea`
  - `input`
  - `contenteditable`
  - React-controlled fields
- Avoid slow per-character keyboard events unless needed.
- Keep native value setter plus `input`/`change` events.

Done when:
- Long prompts are inserted reliably and quickly.
- FlowMusic UI reacts as if the user typed manually.

## Task 8: Add Prompt File Validation

File:
- `popup.js`

Work:
- Validate `.txt` file content.
- Warn if prompt count is too high.
- Warn if a line is too long.
- Optionally remove duplicate prompts.
- Handle file read errors.

Done when:
- Bad or empty files produce clear messages.
- Large prompt lists do not accidentally start without warning.

## Task 9: Add Resume and Reset Controls

Files:
- `popup.html`
- `popup.js`

Work:
- Add clearer controls:
  - Start from beginning
  - Resume from current prompt
  - Reset progress
- Make current progress visible.

Done when:
- The user can choose whether to continue from saved progress or restart from prompt 1.

## Task 10: Add Debug Mode

Files:
- `popup.html`
- `popup.js`
- `content.js`

Work:
- Add a Debug checkbox or toggle.
- When enabled, log:
  - input selector found
  - submit selector found
  - loading selector status
  - done detection status
  - message errors
- Optionally save recent logs in `chrome.storage.local`.

Done when:
- Selector and automation problems can be diagnosed from popup logs without opening DevTools first.

## Recommended Order

1. Fix encoding.
2. Fix `runState`.
3. Add message error handling.
4. Tighten loading detection.
5. Add done detection.
6. Improve submit detection.
7. Improve input handling.
8. Add file validation.
9. Add resume/reset controls.
10. Add debug mode.

## Minimum Stable Release Scope

For a quick stable update, complete:

- Task 1
- Task 2
- Task 3
- Task 4
- Task 5

