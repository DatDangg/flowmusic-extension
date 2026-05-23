// =====================
// State
// =====================
let prompts = [];
let isRunning = false;
let pendingWarnings = [];

const MAX_PROMPT_WARNING = 100;
const LONG_PROMPT_WARNING = 1200;
const FLOWMUSIC_HOSTS = new Set(['flowmusic.app', 'www.flowmusic.app']);
const $ = (id) => document.getElementById(id);

// =====================
// Init
// =====================
document.addEventListener('DOMContentLoaded', async () => {
  await loadSavedState();
  bindEvents();
});

async function loadSavedState() {
  const data = await chrome.storage.local.get(['prompts', 'currentIndex', 'settings', 'runState', 'debugLogs']);
  if (data.prompts) {
    prompts = data.prompts;
    renderPromptList(data.currentIndex || 0);
    updateCount();
    updateStartButtons();
  }
  if (data.settings) {
    $('waitAfterSend').value = data.settings.waitAfterSend || 5;
    $('maxWait').value = data.settings.maxWait || 300;
    $('debugMode').checked = Boolean(data.settings.debug);
  }
  renderDebugLogs(Array.isArray(data.debugLogs) ? data.debugLogs : []);
  if (data.runState?.running) {
    isRunning = true;
    setRunningUI(true);
    renderPromptList(data.runState.currentIndex);
    refreshStatusFromStorage();
  }
}

// =====================
// Events
// =====================
function bindEvents() {
  $('uploadZone').addEventListener('click', () => $('fileInput').click());
  $('fileInput').addEventListener('change', handleFileSelect);

  $('uploadZone').addEventListener('dragover', (e) => {
    e.preventDefault();
    $('uploadZone').classList.add('dragover');
  });
  $('uploadZone').addEventListener('dragleave', () => $('uploadZone').classList.remove('dragover'));
  $('uploadZone').addEventListener('drop', (e) => {
    e.preventDefault();
    $('uploadZone').classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) readFile(file);
  });

  $('startBtn').addEventListener('click', () => startAutomation({ mode: 'resume' }));
  $('restartBtn').addEventListener('click', () => startAutomation({ mode: 'restart' }));
  $('resetProgressBtn').addEventListener('click', resetProgress);
  $('stopBtn').addEventListener('click', stopAutomation);
  $('clearBtn').addEventListener('click', clearAll);
  $('debugMode').addEventListener('change', saveSettingsOnly);
  $('clearDebugBtn').addEventListener('click', clearDebugLogs);

  chrome.runtime.onMessage.addListener(handleContentMessage);
}

// =====================
// File handling
// =====================
function handleFileSelect(e) {
  const file = e.target.files[0];
  if (file) readFile(file);
}

function readFile(file) {
  if (!file.name.toLowerCase().endsWith('.txt')) {
    setLog('❌ Chỉ hỗ trợ file .txt', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = async (e) => {
    const validation = validatePromptFile(String(e.target.result || ''));
    if (!validation.ok) {
      setLog(validation.error, 'error');
      $('statusBar').classList.add('visible');
      return;
    }

    prompts = validation.prompts;
    pendingWarnings = validation.warnings;
    await chrome.storage.local.set({ prompts, currentIndex: 0 });
    await saveRunState(false, 0);
    renderPromptList(0);
    updateCount();
    updateStartButtons();
    $('statusBar').classList.add('visible');

    const suffix = pendingWarnings.length > 0 ? ` ${pendingWarnings.join(' ')}` : '';
    setLog(`✅ Đã tải ${prompts.length} prompt từ "${file.name}".${suffix}`, pendingWarnings.length ? 'info' : 'success');
  };
  reader.onerror = () => {
    setLog('❌ Không đọc được file. Vui lòng thử lại.', 'error');
    $('statusBar').classList.add('visible');
  };
  reader.readAsText(file, 'UTF-8');
}

function validatePromptFile(raw) {
  const normalized = raw.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const cleaned = parsePromptText(normalized);

  if (cleaned.length === 0) {
    return { ok: false, error: '❌ File không có nội dung hợp lệ.' };
  }

  const seen = new Set();
  const prompts = [];
  let duplicateCount = 0;
  cleaned.forEach(prompt => {
    const key = prompt.toLocaleLowerCase('vi');
    if (seen.has(key)) {
      duplicateCount += 1;
      return;
    }
    seen.add(key);
    prompts.push(prompt);
  });

  const warnings = [];
  if (prompts.length > MAX_PROMPT_WARNING) {
    warnings.push(`⚠ File có ${prompts.length} prompt, hãy kiểm tra trước khi chạy.`);
  }
  const longCount = prompts.filter(prompt => prompt.length > LONG_PROMPT_WARNING).length;
  if (longCount > 0) {
    warnings.push(`⚠ Có ${longCount} prompt dài hơn ${LONG_PROMPT_WARNING} ký tự.`);
  }
  if (duplicateCount > 0) {
    warnings.push(`Đã bỏ ${duplicateCount} prompt trùng.`);
  }

  return { ok: true, prompts, warnings };
}

function parsePromptText(normalized) {
  const hasBlockDelimiter = normalized
    .split('\n')
    .some(line => /^-{3,}$/.test(line.trim()));

  if (hasBlockDelimiter) {
    const blocks = normalized
      .split(/^\s*-{3,}\s*$/m)
      .map(block => block.trim())
      .filter(Boolean);
    const numberedBlocks = blocks.filter(block => /^##\s+\d+[\.)]?\s+.+/m.test(block));
    return numberedBlocks.length > 0 ? numberedBlocks : blocks;
  }

  return normalized
    .split('\n')
    .map(line => line.trim())
    .map(line => line.replace(/^\d+[\.)]\s*/, ''))
    .filter(Boolean);
}

// =====================
// Render
// =====================
function renderPromptList(currentIndex = 0) {
  const list = $('promptList');
  if (prompts.length === 0) {
    list.innerHTML = '<div class="empty-prompts">Chưa có prompt nào. Tải file .txt lên.</div>';
    return;
  }
  list.innerHTML = prompts.map((p, i) => {
    let cls = '';
    if (i < currentIndex) cls = 'done';
    else if (i === currentIndex) cls = 'active';
    return `<div class="prompt-item ${cls}">
      <span class="prompt-num">${i + 1}</span>
      <span class="prompt-text" title="${escHtml(p)}">${escHtml(p)}</span>
    </div>`;
  }).join('');
  const activeEl = list.querySelectorAll('.prompt-item')[currentIndex];
  if (activeEl) activeEl.scrollIntoView({ block: 'nearest' });
}

function updateCount() {
  $('promptCount').textContent = `${prompts.length} prompts`;
}

// =====================
// Automation
// =====================
async function startAutomation({ mode }) {
  if (prompts.length === 0) return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!isFlowMusicUrl(tab?.url)) {
    setLog('❌ Vui lòng mở tab flowmusic.app trước.', 'error');
    $('statusBar').classList.add('visible');
    return;
  }

  const currentData = await chrome.storage.local.get('currentIndex');
  const startIndex = mode === 'restart' ? 0 : Math.min(currentData.currentIndex || 0, Math.max(prompts.length - 1, 0));

  if (pendingWarnings.length > 0 && !confirm(`File prompt có cảnh báo:\n\n${pendingWarnings.join('\n')}\n\nBạn vẫn muốn bắt đầu?`)) {
    setLog('⚠ Đã hủy chạy để kiểm tra lại file prompt.', 'info');
    return;
  }

  if (mode === 'restart') {
    await chrome.storage.local.set({ currentIndex: 0 });
    renderPromptList(0);
    updateProgress(0, prompts.length);
  }

  const settings = {
    waitAfterSend: parseInt($('waitAfterSend').value, 10) || 5,
    maxWait: parseInt($('maxWait').value, 10) || 300,
    debug: $('debugMode').checked,
  };
  const selectors = { input: null, submit: null, loading: null };

  await chrome.storage.local.set({ settings, selectors });
  await saveRunState(true, startIndex, { resetStartedAt: true });

  const sent = await sendTabMessage(tab.id, {
    action: 'START',
    prompts,
    startIndex,
    settings,
    selectors,
  }, 'Không gửi được lệnh bắt đầu. Hãy tải lại tab FlowMusic rồi thử lại.');

  if (!sent) {
    isRunning = false;
    await saveRunState(false, startIndex);
    setRunningUI(false);
    return;
  }

  isRunning = true;
  setRunningUI(true);
  $('statusBar').classList.add('visible');
  setStatus(`Prompt ${startIndex + 1}/${prompts.length}`, true);
  updateProgress(startIndex, prompts.length);
  setLog(mode === 'restart' ? '🚀 Bắt đầu lại từ prompt đầu tiên.' : '🚀 Tiếp tục tự động hóa...', 'info');
}

async function stopAutomation() {
  const tab = await findFlowMusicTab();
  if (tab) {
    await sendTabMessage(tab.id, { action: 'STOP' }, 'Không gửi được lệnh dừng. Content script có thể chưa sẵn sàng.');
  }
  isRunning = false;
  await saveRunState(false);
  setRunningUI(false);
  setLog('⏹ Đã dừng. Automation đã được ngắt theo yêu cầu.', 'info');
  $('dotPulse').style.display = 'none';
}

async function resetProgress() {
  await chrome.storage.local.set({ currentIndex: 0 });
  await saveRunState(false, 0);
  renderPromptList(0);
  updateProgress(0, prompts.length);
  setStatus(prompts.length ? `Prompt 1/${prompts.length}` : 'Chưa có prompt', false);
  setLog('↺ Đã reset tiến độ về prompt đầu tiên.', 'info');
  $('statusBar').classList.add('visible');
}

async function clearAll() {
  prompts = [];
  pendingWarnings = [];
  await chrome.storage.local.set({ prompts: [], currentIndex: 0 });
  await saveRunState(false, 0);
  renderPromptList(0);
  updateCount();
  updateStartButtons();
  $('statusBar').classList.remove('visible');
  $('fileInput').value = '';
}

// =====================
// Message handler
// =====================
function handleContentMessage(msg) {
  if (msg.type === 'STATUS') {
    $('statusBar').classList.add('visible');
    if (msg.index !== undefined) {
      renderPromptList(msg.index);
      chrome.storage.local.set({ currentIndex: msg.index });
      saveRunState(msg.running !== false, msg.index);
      setStatus(`Prompt ${Math.min(msg.index + 1, prompts.length)}/${prompts.length}`, msg.running);
      updateProgress(msg.index, prompts.length);
    }
    if (msg.log) setLog(msg.log, msg.logType || '');
    if (Array.isArray(msg.debug) && msg.debug.length > 0) appendDebugLogs(msg.debug);
    if (msg.running === false) {
      isRunning = false;
      saveRunState(false, msg.index);
      setRunningUI(false);
      $('dotPulse').style.display = 'none';
    }
  }
  if (msg.type === 'DEBUG') {
    appendDebugLogs([msg.message]);
  }
  if (msg.type === 'DONE') {
    isRunning = false;
    setRunningUI(false);
    $('dotPulse').style.display = 'none';
    updateProgress(prompts.length, prompts.length);
    renderPromptList(prompts.length);
    setLog(`🎉 Hoàn tất. Đã xử lý ${prompts.length} prompt.`, 'success');
    chrome.storage.local.set({ currentIndex: 0 });
    saveRunState(false, 0);
  }
}

function refreshStatusFromStorage() {
  chrome.storage.local.get(['runState', 'currentIndex'], (data) => {
    const idx = data.runState?.currentIndex ?? data.currentIndex ?? 0;
    renderPromptList(idx);
    setStatus(`Prompt ${idx + 1}/${prompts.length}`, true);
    updateProgress(idx, prompts.length);
  });
}

// =====================
// UI helpers
// =====================
function setRunningUI(running) {
  $('startBtn').disabled = running || prompts.length === 0;
  $('restartBtn').disabled = running || prompts.length === 0;
  $('resetProgressBtn').disabled = running || prompts.length === 0;
  $('stopBtn').disabled = !running;
  $('dotPulse').style.display = running ? 'inline-flex' : 'none';
}

function updateStartButtons() {
  setRunningUI(isRunning);
}

function setStatus(text, running) {
  $('statusText').innerHTML = `<strong>${escHtml(text)}</strong>`;
  $('dotPulse').style.display = running ? 'inline-flex' : 'none';
}

function setLog(msg, type = '') {
  const el = $('statusLog');
  el.textContent = msg;
  el.className = 'status-log' + (type ? ` ${type}` : '');
}

function updateProgress(current, total) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  $('progressFill').style.width = pct + '%';
}

async function saveSettingsOnly() {
  return chrome.storage.local.set({
    settings: {
      waitAfterSend: parseInt($('waitAfterSend').value, 10) || 5,
      maxWait: parseInt($('maxWait').value, 10) || 300,
      debug: $('debugMode').checked,
    }
  });
}

async function saveRunState(running, currentIndex, options = {}) {
  const data = await chrome.storage.local.get('runState');
  const previous = data.runState || {};
  const payload = { running };
  if (Number.isInteger(currentIndex)) {
    payload.currentIndex = currentIndex;
  } else if (Number.isInteger(previous.currentIndex)) {
    payload.currentIndex = previous.currentIndex;
  }
  if (running) {
    payload.startedAt = options.resetStartedAt ? Date.now() : (previous.startedAt || Date.now());
  }
  return chrome.storage.local.set({ runState: payload });
}

function sendTabMessage(tabId, message, userErrorMessage) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      const error = chrome.runtime.lastError;
      if (error) {
        setLog(`❌ ${userErrorMessage} (${error.message})`, 'error');
        $('statusBar').classList.add('visible');
        resolve(false);
        return;
      }
      resolve(response?.ok !== false);
    });
  });
}

async function appendDebugLogs(messages) {
  const stamped = messages.map(message => ({
    time: new Date().toLocaleTimeString('vi-VN', { hour12: false }),
    message: String(message),
  }));
  const data = await chrome.storage.local.get('debugLogs');
  const logs = [...(data.debugLogs || []), ...stamped].slice(-80);
  await chrome.storage.local.set({ debugLogs: logs });
  renderDebugLogs(logs);
}

function renderDebugLogs(logs) {
  const el = $('debugLog');
  const recentLogs = logs.slice(-20).map(normalizeDebugLog);
  if (recentLogs.length === 0) {
    el.innerHTML = '<div class="debug-empty">Chưa có debug log.</div>';
    return;
  }
  el.innerHTML = recentLogs.map(log => `
    <div class="debug-line">
      <span class="debug-time">${escHtml(log.time)}</span>
      <span class="debug-message">${escHtml(log.message)}</span>
    </div>
  `).join('');
  el.scrollTop = el.scrollHeight;
}

async function clearDebugLogs() {
  await chrome.storage.local.set({ debugLogs: [] });
  renderDebugLogs([]);
  setLog('Đã xóa log debug.', 'info');
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function normalizeDebugLog(log) {
  if (log && typeof log === 'object') {
    return {
      time: log.time || '--:--:--',
      message: log.message || '',
    };
  }
  const text = String(log || '');
  const match = text.match(/^\[([^\]]+)\]\s*(.*)$/);
  return {
    time: match?.[1] || '--:--:--',
    message: match?.[2] || text,
  };
}

async function findFlowMusicTab() {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (isFlowMusicUrl(activeTab?.url)) return activeTab;

  const tabs = await chrome.tabs.query({});
  return tabs.find(tab => isFlowMusicUrl(tab.url)) || null;
}

function isFlowMusicUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && FLOWMUSIC_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
}
