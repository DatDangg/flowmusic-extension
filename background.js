const FLOWMUSIC_HOSTS = new Set(['flowmusic.app', 'www.flowmusic.app']);
const PANEL_PATH = 'popup.html';

initializeSidePanel();

chrome.runtime.onInstalled.addListener(initializeSidePanel);

chrome.runtime.onStartup.addListener(initializeSidePanel);

async function initializeSidePanel() {
  await setSidePanelBehavior();
  await setGlobalSidePanel();
  refreshAllTabs();
}

chrome.action.onClicked.addListener(async (tab) => {
  await openPanelForWindow(tab?.windowId);
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
  refreshActionForTab(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading' || changeInfo.url) {
    refreshActionForTab(tabId, tab);
  }
});

async function refreshAllTabs() {
  const tabs = await chrome.tabs.query({});
  await Promise.all(tabs.map(tab => refreshActionForTab(tab.id, tab)));
}

async function refreshActionForTab(tabId, tab) {
  if (!tabId) return;

  const currentTab = tab?.url ? tab : await chrome.tabs.get(tabId).catch(() => null);
  const isFlowMusicTab = isFlowMusicUrl(currentTab?.url);

  if (isFlowMusicTab) {
    await chrome.action.enable(tabId).catch(() => {});
    await chrome.action.setTitle({
      tabId,
      title: 'Mở FlowMusic Auto Prompt',
    }).catch(() => {});
    return;
  }

  await chrome.action.enable(tabId).catch(() => {});
  await chrome.action.setTitle({
    tabId,
    title: 'Mở FlowMusic để dùng Auto Prompt',
  }).catch(() => {});
}

async function openPanelForWindow(windowId) {
  if (!windowId) return;

  if (!chrome.sidePanel?.open) return;

  await chrome.sidePanel.open({ windowId }).catch(() => {});
}

async function setSidePanelBehavior() {
  if (!chrome.sidePanel?.setPanelBehavior) return;
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});
}

async function setGlobalSidePanel() {
  await setSidePanelOptions({
    path: PANEL_PATH,
    enabled: true,
  });
}

async function setSidePanelOptions(options) {
  if (!chrome.sidePanel?.setOptions) return;
  await chrome.sidePanel.setOptions(options).catch(() => {});
}

function isFlowMusicUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && FLOWMUSIC_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
}
