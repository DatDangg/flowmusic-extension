// =============================================
// FlowMusic Auto Prompt - Content Script
// Chạy trực tiếp trong trang flowmusic.app
// =============================================

let stopRequested = false;
let running = false;
let debugEnabled = false;

// =====================
// Selector strategies
// =====================
const INPUT_SELECTORS = [
  'textarea[placeholder*="prompt" i]',
  'textarea[placeholder*="describe" i]',
  'textarea[placeholder*="song" i]',
  'textarea[placeholder*="music" i]',
  'textarea[placeholder*="nhạc" i]',
  'input[placeholder*="prompt" i]',
  'input[placeholder*="describe" i]',
  'input[placeholder*="song" i]',
  'input[placeholder*="music" i]',
  'input[placeholder*="nhạc" i]',
  'div[contenteditable="true"][data-placeholder]',
  'div[contenteditable="true"]',
  '[role="textbox"]',
  'textarea',
  'input[type="text"]',
];

const SUBMIT_SELECTORS = [
  'button[aria-label*="send" i]',
  'button[aria-label*="submit" i]',
  'button[aria-label*="generate" i]',
  'button[aria-label*="create" i]',
  'button[title*="send" i]',
  'button[title*="submit" i]',
  'button[title*="generate" i]',
  'button[title*="create" i]',
  'button[data-testid*="send" i]',
  'button[data-testid*="submit" i]',
  'button[data-testid*="generate" i]',
  'button[data-testid*="create" i]',
  'button[type="submit"]',
];

const LOADING_SELECTORS = [
  '[aria-label*="loading" i]',
  '[aria-label*="generating" i]',
  '[aria-label*="creating" i]',
  '[class*="loading" i]',
  '[class*="generating" i]',
  '[class*="spinner" i]',
  '[class*="skeleton" i]',
  '[data-testid*="loading" i]',
  '[data-testid*="generating" i]',
  '[data-testid*="spinner" i]',
  '[role="progressbar"]',
  'button[disabled][aria-label*="send" i]',
  'button[disabled][aria-label*="generate" i]',
  'button[disabled][aria-label*="create" i]',
  '.animate-spin',
];

const DONE_SELECTORS = [
  'audio',
  'video',
  '[class*="song-card" i]',
  '[class*="track" i]',
  '[class*="music-item" i]',
  '[class*="result" i]',
  '[data-testid*="song" i]',
  '[data-testid*="track" i]',
  '[data-testid*="result" i]',
  'button[aria-label*="play" i]',
  '[class*="player" i]',
];

const SUBMIT_KEYWORDS = [
  'send',
  'submit',
  'generate',
  'create',
  'go',
  'gửi',
  'gui',
  'tạo',
  'tao',
];

const NEGATIVE_BUTTON_KEYWORDS = [
  'cancel',
  'close',
  'delete',
  'remove',
  'clear',
  'stop',
  'pause',
  'play',
  'download',
  'share',
  'copy',
  'xóa',
  'xoa',
  'dừng',
  'dung',
];

const TRACE_CREATING_TEXT_RE = /\bcreating\b/i;
const TRACE_THOUGHTS_TEXT_RE = /^thoughts$/i;
const TRACE_APPEAR_TIMEOUT = 15000;
const TRACE_CONFIRM_DELAY = 1200;

// =====================
// Message listener
// =====================
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'START') {
    debugEnabled = Boolean(msg.settings?.debug);
    startQueue(msg.prompts, msg.startIndex, msg.settings, msg.selectors);
    sendResponse({ ok: true });
    return true;
  }
  if (msg.action === 'STOP') {
    stopRequested = true;
    running = false;
    sendStatus({ running: false, log: '⏹ Đã dừng. Automation đã được ngắt theo yêu cầu.', logType: 'info' });
    sendResponse({ ok: true });
    return true;
  }
  if (msg.action === 'DETECT') {
    debugEnabled = Boolean(msg.debug);
    const result = detectSelectors();
    chrome.runtime.sendMessage({ type: 'DETECT_RESULT', selectors: result });
    sendResponse({ ok: true });
    return true;
  }
});

// =====================
// Main queue runner
// =====================
async function startQueue(prompts, startIndex, settings, customSelectors) {
  if (running) return;
  running = true;
  stopRequested = false;

  const waitAfterSend = (settings?.waitAfterSend || 5) * 1000;
  const maxWait = (settings?.maxWait || 300) * 1000;

  sendStatus({ index: startIndex, running: true, log: `🚀 Bắt đầu từ prompt #${startIndex + 1}`, logType: 'info' });
  debugLog(`Queue started: ${prompts.length} prompts, startIndex=${startIndex}`);

  for (let i = startIndex; i < prompts.length; i++) {
    if (stopRequested) break;

    const prompt = prompts[i];
    sendStatus({ index: i, running: true, log: `✍ Đang nhập prompt ${i + 1}/${prompts.length}...`, logType: 'info' });

    const input = findElement(customSelectors?.input, INPUT_SELECTORS, 'input');
    if (!input) {
      sendStatus({ index: i, running: false, log: '❌ Không tìm thấy ô nhập. Thử "Detect selectors".', logType: 'error' });
      running = false;
      return;
    }
    debugLog(`Input found: ${describeElement(input)}`);

    const typed = await setPromptValue(input, prompt);
    debugLog(`Prompt value set via ${typed}, length=${prompt.length}`);
    await sleep(300);

    const initialDoneCount = getDoneCount();
    const initialThoughtsCount = getThoughtsCount();
    debugLog(`Done count before submit: ${initialDoneCount}`);
    debugLog(`Thoughts count before submit: ${initialThoughtsCount}`);

    const btn = findSubmitButton(customSelectors?.submit, input);
    if (!btn) {
      debugLog('Submit button not found; using Enter fallback');
      sendStatus({ index: i, running: true, log: '⌨ Không thấy nút gửi, dùng Enter...', logType: 'info' });
      dispatchEnter(input);
    } else {
      debugLog(`Submit button found: ${describeElement(btn)}`);
      btn.click();
    }

    sendStatus({ index: i, running: true, log: `📤 Đã gửi prompt ${i + 1}. Chờ ${settings?.waitAfterSend || 5}s...`, logType: 'info' });
    await sleep(waitAfterSend);

    if (stopRequested) break;

    sendStatus({ index: i, running: true, log: `⏳ Đang chờ FlowMusic tạo bài ${i + 1}...`, logType: 'info' });
    const traceStartedAt = Date.now();
    const traceResult = await waitForTraceCompletion(initialThoughtsCount, maxWait, i, prompts.length);
    let done = traceResult.completed;
    const remainingWait = Math.max(0, maxWait - (Date.now() - traceStartedAt));

    if (!done && !stopRequested && remainingWait > 0) {
      debugLog(traceResult.usedTrace
        ? 'Trace wait did not complete; falling back to generation detection'
        : 'Creating trace not detected; falling back to generation detection');
      done = await waitForGeneration(customSelectors?.loading, remainingWait, i, prompts.length, initialDoneCount);
    }

    if (stopRequested) {
      sendStatus({ index: i, running: false, log: '⏹ Đã dừng. Automation đã được ngắt theo yêu cầu.', logType: 'info' });
      break;
    }

    if (!done) {
      sendStatus({ index: i, running: true, log: `⚠ Timeout prompt ${i + 1}, tiếp tục prompt tiếp theo.`, logType: 'error' });
    } else {
      sendStatus({ index: i + 1, running: true, log: `✅ Bài ${i + 1} xong. Chuẩn bị prompt tiếp theo...`, logType: 'success' });
    }

    chrome.storage.local.set({ currentIndex: i + 1 });
    await sleep(1500);
  }

  if (!stopRequested) {
    chrome.runtime.sendMessage({ type: 'DONE' });
  }
  running = false;
}

// =====================
// Wait for generation
// =====================
async function waitForTraceCompletion(initialThoughtsCount, maxWait, idx, total) {
  const started = Date.now();
  const appearDeadline = started + Math.min(TRACE_APPEAR_TIMEOUT, maxWait);
  const deadline = started + maxWait;
  const fallbackPoll = 2000;
  let traceSeen = isFlowMusicCreating();
  let completeFirstSeenAt = 0;
  let lastStatusAt = 0;

  debugLog(`Trace wait started: creating=${traceSeen}, initialThoughtsCount=${initialThoughtsCount}`);

  while (Date.now() < deadline) {
    if (stopRequested) return { completed: false, usedTrace: traceSeen };

    const now = Date.now();
    const creating = isFlowMusicCreating();
    const thoughtsCount = getThoughtsCount();
    const hasNewThoughts = thoughtsCount > initialThoughtsCount;

    if (creating) traceSeen = true;

    debugLog(`Trace check: creating=${creating}, traceSeen=${traceSeen}, thoughtsCount=${thoughtsCount}, initialThoughtsCount=${initialThoughtsCount}`);

    if (!traceSeen && !creating && hasNewThoughts) {
      debugLog('New Thoughts heading detected before active trace was observed');
      return { completed: true, usedTrace: traceSeen };
    }

    if (!traceSeen && now >= appearDeadline) {
      return { completed: false, usedTrace: false };
    }

    if (traceSeen && !creating && hasNewThoughts) {
      if (!completeFirstSeenAt) {
        completeFirstSeenAt = now;
        debugLog('Trace completion candidate detected');
      }
      if (now - completeFirstSeenAt >= TRACE_CONFIRM_DELAY) {
        debugLog('Trace completion confirmed');
        return { completed: true, usedTrace: true };
      }
    } else {
      completeFirstSeenAt = 0;
    }

    if (now - lastStatusAt >= fallbackPoll) {
      const elapsed = Math.round((now - started) / 1000);
      sendStatus({
        index: idx,
        running: true,
        log: `Waiting for FlowMusic trace ${idx + 1}/${total}... (${elapsed}s)`,
        logType: 'info'
      });
      lastStatusAt = now;
    }

    await waitForDomChange(Math.min(fallbackPoll, Math.max(0, deadline - Date.now())));
  }

  debugLog(`Trace wait timed out: traceSeen=${traceSeen}`);
  return { completed: false, usedTrace: traceSeen };
}

async function waitForGeneration(customLoadingSelector, maxWait, idx, total, initialDoneCount) {
  const started = Date.now();
  const deadline = started + maxWait;
  const fallbackPoll = 2000;
  const confirmDelay = 1200;
  const loadingGraceAfterDone = 4000;
  let lastStatusAt = 0;
  let newDoneFirstSeenAt = 0;
  let loadingAppeared = false;
  while (Date.now() < deadline) {
    if (stopRequested) return false;

    const loading = isLoading(customLoadingSelector);
    const doneCount = getDoneCount();
    const hasNewDone = doneCount > initialDoneCount;
    const now = Date.now();

    if (loading) {
      loadingAppeared = true;
    }

    if (!loadingAppeared && now - started >= 15000) {
      loadingAppeared = true;
      debugLog('Loading indicator did not appear within 15s; waiting for done result');
    }

    debugLog(`Wait check: loading=${loading}, doneCount=${doneCount}, initialDoneCount=${initialDoneCount}`);
    if (hasNewDone) {
      if (!newDoneFirstSeenAt) {
        newDoneFirstSeenAt = now;
        debugLog('New done result appeared');
      }

      const loadingLooksStale = loading && (now - newDoneFirstSeenAt >= loadingGraceAfterDone);
      if (!loading || loadingLooksStale) {
        await sleep(confirmDelay);
        const confirmed = hasNewDoneResult(initialDoneCount);
        const stillLoading = isLoading(customLoadingSelector);
        debugLog(`Done detection confirmed=${confirmed}`);
        if (confirmed && (!stillLoading || loadingLooksStale)) return true;
      }
    }

    if (now - lastStatusAt >= fallbackPoll) {
      const elapsed = Math.round((now - started) / 1000);
      sendStatus({
        index: idx,
        running: true,
      log: `⏳ Đang tạo bài ${idx + 1}/${total}... (${elapsed}s)`,
        logType: 'info'
      });
      lastStatusAt = now;
    }
    await waitForDomChange(Math.min(fallbackPoll, Math.max(0, deadline - Date.now())));
  }

  debugLog('Generation wait timed out');
  return false;
}

function waitForDomChange(timeout) {
  return new Promise(resolve => {
    let done = false;
    let observer = null;

    const finish = () => {
      if (done) return;
      done = true;
      if (observer) observer.disconnect();
      clearTimeout(timer);
      resolve();
    };

    const timer = setTimeout(finish, timeout);

    try {
      observer = new MutationObserver(finish);
      observer.observe(document.body || document.documentElement, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['class', 'style', 'disabled', 'aria-disabled', 'aria-label', 'data-testid'],
      });
    } catch (e) {
      debugLog(`Mutation observer unavailable: ${e.message}`);
    }
  });
}

// =====================
// DOM helpers
// =====================
function findElement(customSelector, fallbacks, label) {
  if (customSelector) {
    try {
      const el = document.querySelector(customSelector);
      if (el && isVisible(el)) return el;
      debugLog(`${label || 'element'} custom selector not visible: ${customSelector}`);
    } catch (e) {
      debugLog(`${label || 'element'} custom selector error: ${e.message}`);
    }
  }
  for (const sel of fallbacks) {
    try {
      const el = document.querySelector(sel);
      if (el && isVisible(el)) {
        debugLog(`${label || 'element'} selector matched: ${sel}`);
        return el;
      }
    } catch (e) {}
  }
  return null;
}

function findSubmitButton(customSelector, inputEl) {
  if (customSelector) {
    try {
      const el = document.querySelector(customSelector);
      const button = normalizeButton(el);
      if (button && isUsableButton(button)) return button;
      debugLog(`Submit custom selector not usable: ${customSelector}`);
    } catch (e) {
      debugLog(`Submit custom selector error: ${e.message}`);
    }
  }

  const candidates = collectSubmitCandidates(inputEl)
    .filter(button => isUsableButton(button))
    .map(button => ({ button, score: scoreSubmitButton(button, inputEl) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score);

  debugLog(`Submit candidates: ${candidates.slice(0, 5).map(item => `${Math.round(item.score)}:${getButtonLabel(item.button).slice(0, 40)}`).join(' | ') || 'none'}`);
  return candidates[0]?.button || null;
}

function collectSubmitCandidates(inputEl) {
  const buttons = new Set();

  for (const sel of SUBMIT_SELECTORS) {
    try {
      document.querySelectorAll(sel).forEach(el => {
        const button = normalizeButton(el);
        if (button) buttons.add(button);
      });
    } catch (e) {}
  }

  if (inputEl) {
    const scopes = [
      inputEl.closest('form'),
      inputEl.closest('[role="form"]'),
      inputEl.closest('section'),
      inputEl.parentElement,
      inputEl.parentElement?.parentElement,
      inputEl.parentElement?.parentElement?.parentElement,
    ].filter(Boolean);

    scopes.forEach(scope => {
      scope.querySelectorAll('button').forEach(button => buttons.add(button));
    });
  }

  return Array.from(buttons);
}

function normalizeButton(el) {
  if (!el) return null;
  return el.tagName?.toLowerCase() === 'button' ? el : el.closest?.('button');
}

function isUsableButton(button) {
  return button
    && isVisible(button)
    && !button.disabled
    && button.getAttribute('aria-disabled') !== 'true';
}

function scoreSubmitButton(button, inputEl) {
  const label = getButtonLabel(button);
  let score = 0;

  if (button.type === 'submit') score += 25;
  if (hasAnyKeyword(label, SUBMIT_KEYWORDS)) score += 45;
  if (button.querySelector('svg[class*="send" i], svg[class*="arrow" i]')) score += 15;
  if (button.querySelector('[class*="send" i], [data-testid*="send" i]')) score += 20;
  if (inputEl) score += proximityScore(button, inputEl);
  if (hasAnyKeyword(label, NEGATIVE_BUTTON_KEYWORDS)) score -= 80;

  return score;
}

function getButtonLabel(button) {
  return [
    button.innerText,
    button.textContent,
    button.getAttribute('aria-label'),
    button.getAttribute('title'),
    button.getAttribute('data-testid'),
    button.className,
  ].filter(Boolean).join(' ').toLowerCase();
}

function hasAnyKeyword(text, keywords) {
  return keywords.some(keyword => text.includes(keyword));
}

function proximityScore(button, inputEl) {
  if (button.form && inputEl.form && button.form === inputEl.form) return 35;

  let node = inputEl.parentElement;
  for (let depth = 0; node && depth < 5; depth++) {
    if (node.contains(button)) return 30 - (depth * 4);
    node = node.parentElement;
  }

  const inputRect = inputEl.getBoundingClientRect();
  const buttonRect = button.getBoundingClientRect();
  const dx = Math.abs((inputRect.left + inputRect.right) / 2 - (buttonRect.left + buttonRect.right) / 2);
  const dy = Math.abs((inputRect.top + inputRect.bottom) / 2 - (buttonRect.top + buttonRect.bottom) / 2);
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance < 120) return 20;
  if (distance < 260) return 12;
  if (distance < 500) return 5;
  return 0;
}

function isLoading(customSelector) {
  if (customSelector) {
    try {
      const el = document.querySelector(customSelector);
      if (el && isVisible(el)) return true;
    } catch (e) {
      debugLog(`Loading custom selector error: ${e.message}`);
    }
  }
  for (const sel of LOADING_SELECTORS) {
    try {
      const els = document.querySelectorAll(sel);
      for (const el of els) {
        if (isVisible(el)) {
          debugLog(`Loading selector visible: ${sel}`);
          return true;
        }
      }
    } catch (e) {}
  }
  return hasDisabledSubmitButton();
}

function hasDisabledSubmitButton() {
  for (const button of document.querySelectorAll('button:disabled, button[aria-disabled="true"]')) {
    if (!isVisible(button)) continue;
    const label = getButtonLabel(button);
    if (hasAnyKeyword(label, SUBMIT_KEYWORDS)) {
      debugLog('Disabled submit button detected as loading');
      return true;
    }
  }
  return false;
}

function isFlowMusicCreating() {
  return Boolean(findCreatingTraceElement());
}

function findCreatingTraceElement() {
  const targetedSelectors = [
    '[class*="progress-trace-header"]',
    '[class*="text-progress-trace-active"]',
  ];

  for (const sel of targetedSelectors) {
    try {
      for (const el of document.querySelectorAll(sel)) {
        if (isVisible(el) && TRACE_CREATING_TEXT_RE.test(normalizedText(el))) return el;
      }
    } catch (e) {}
  }

  try {
    for (const el of document.querySelectorAll('div, span, p, button, [role="heading"]')) {
      const text = normalizedText(el);
      if (text.length <= 180 && TRACE_CREATING_TEXT_RE.test(text) && isVisible(el)) return el;
    }
  } catch (e) {}

  return null;
}

function getThoughtsCount() {
  const elements = new Set();
  try {
    for (const el of document.querySelectorAll('div, span, p, button, [role="heading"]')) {
      if (!isVisible(el) || !TRACE_THOUGHTS_TEXT_RE.test(normalizedText(el))) continue;
      const hasExactThoughtsChild = Array.from(el.children).some(child => TRACE_THOUGHTS_TEXT_RE.test(normalizedText(child)));
      if (!hasExactThoughtsChild) elements.add(el);
    }
  } catch (e) {}
  return elements.size;
}

function normalizedText(el) {
  return (el?.textContent || '').replace(/\s+/g, ' ').trim();
}

function getDoneCount() {
  const elements = new Set();
  for (const sel of DONE_SELECTORS) {
    try {
      document.querySelectorAll(sel).forEach(el => {
        if (isVisible(el)) elements.add(el);
      });
    } catch (e) {}
  }
  return elements.size;
}

function hasNewDoneResult(initialDoneCount) {
  return getDoneCount() > initialDoneCount;
}

async function setPromptValue(el, text) {
  el.focus();
  await sleep(80);

  if (el.isContentEditable) {
    setContentEditableText(el, text);
    dispatchTextEvents(el, text);
    return 'contenteditable';
  }

  if (el.tagName?.toLowerCase() === 'textarea' || el.tagName?.toLowerCase() === 'input') {
    setNativeValue(el, text);
    dispatchTextEvents(el, text);
    if (el.value !== text) {
      await keyboardFallback(el, text);
      return 'keyboard-fallback';
    }
    return 'native-value';
  }

  setContentEditableText(el, text);
  dispatchTextEvents(el, text);
  return 'generic-text';
}

function setNativeValue(el, text) {
  const prototype = el.tagName?.toLowerCase() === 'textarea'
    ? window.HTMLTextAreaElement.prototype
    : window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
  if (setter) setter.call(el, text);
  else el.value = text;

  // React tracks previous values; clearing the tracker forces change propagation.
  if (el._valueTracker) {
    el._valueTracker.setValue('');
  }
}

function setContentEditableText(el, text) {
  const selection = window.getSelection();
  const range = document.createRange();
  el.textContent = '';
  range.selectNodeContents(el);
  selection.removeAllRanges();
  selection.addRange(range);
  document.execCommand('insertText', false, text);
  if ((el.innerText || el.textContent) !== text) {
    el.textContent = text;
  }
}

function dispatchTextEvents(el, text) {
  el.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, inputType: 'insertText', data: text }));
  el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

async function keyboardFallback(el, text) {
  el.value = '';
  for (const char of text) {
    el.value += char;
    el.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
    el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: char }));
    el.dispatchEvent(new KeyboardEvent('keyup', { key: char, bubbles: true }));
    if (text.length > 200 && el.value.length % 80 === 0) await sleep(0);
  }
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

function dispatchEnter(el) {
  el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
  el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true }));
}

function isVisible(el) {
  if (!el) return false;
  const rect = el.getBoundingClientRect();
  const style = window.getComputedStyle(el);
  return rect.width > 0 && rect.height > 0
    && style.display !== 'none'
    && style.visibility !== 'hidden'
    && style.opacity !== '0';
}

// =====================
// Auto-detect selectors
// =====================
function detectSelectors() {
  const result = {};

  for (const sel of INPUT_SELECTORS) {
    try {
      const el = document.querySelector(sel);
      if (el && isVisible(el)) {
        result.input = sel;
        debugLog(`Detect input selector: ${sel}`);
        break;
      }
    } catch (e) {}
  }

  const input = result.input ? document.querySelector(result.input) : null;
  const button = findSubmitButton(null, input);
  if (button) {
    result.submit = selectorForElement(button);
    debugLog(`Detect submit selector: ${result.submit}`);
  }

  for (const sel of LOADING_SELECTORS) {
    try {
      const el = document.querySelector(sel);
      if (el && isVisible(el)) {
        result.loading = sel;
        debugLog(`Detect loading selector: ${sel}`);
        break;
      }
    } catch (e) {}
  }

  return Object.keys(result).length > 0 ? result : null;
}

function selectorForElement(el) {
  if (el.id) return `#${CSS.escape(el.id)}`;
  const testId = el.getAttribute('data-testid');
  if (testId) return `${el.tagName.toLowerCase()}[data-testid="${CSS.escape(testId)}"]`;
  const aria = el.getAttribute('aria-label');
  if (aria) return `${el.tagName.toLowerCase()}[aria-label="${CSS.escape(aria)}"]`;
  if (el.type) return `${el.tagName.toLowerCase()}[type="${CSS.escape(el.type)}"]`;
  return el.tagName.toLowerCase();
}

// =====================
// Helpers
// =====================
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function sendStatus(data) {
  try {
    chrome.runtime.sendMessage({ type: 'STATUS', ...data });
  } catch (e) {}
}

function debugLog(message) {
  if (!debugEnabled) return;
  try {
    chrome.runtime.sendMessage({ type: 'DEBUG', message });
  } catch (e) {}
}

function describeElement(el) {
  if (!el) return 'none';
  const parts = [el.tagName?.toLowerCase()];
  if (el.id) parts.push(`#${el.id}`);
  if (el.getAttribute('data-testid')) parts.push(`[data-testid="${el.getAttribute('data-testid')}"]`);
  if (el.getAttribute('aria-label')) parts.push(`[aria-label="${el.getAttribute('aria-label')}"]`);
  if (el.getAttribute('placeholder')) parts.push(`[placeholder="${el.getAttribute('placeholder')}"]`);
  return parts.filter(Boolean).join('');
}
