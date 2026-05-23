const FLOWMUSIC_HOSTS = new Set(['flowmusic.app', 'www.flowmusic.app']);
const PANEL_PATH = 'popup.html';

chrome.runtime.onInstalled.addListener(async () => {
  await setSidePanelBehavior();
  refreshAllTabs();
});

chrome.runtime.onStartup.addListener(refreshAllTabs);

chrome.action.onClicked.addListener(async (tab) => {
  if (isFlowMusicUrl(tab?.url)) {
    openPanelForTab(tab.id, tab.windowId);
    return;
  }

  await confirmOpenFlowMusic(tab?.id, tab?.windowId);
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
  refreshTab(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading' || changeInfo.url || tab.url) {
    refreshTab(tabId, tab);
  }
});

async function refreshAllTabs() {
  const tabs = await chrome.tabs.query({});
  await Promise.all(tabs.map(tab => refreshTab(tab.id, tab)));
}

async function refreshTab(tabId, tab) {
  if (!tabId) return;

  const currentTab = tab?.url ? tab : await chrome.tabs.get(tabId).catch(() => null);
  const isFlowMusicTab = isFlowMusicUrl(currentTab?.url);

  await setSidePanelOptions({
    tabId,
    path: PANEL_PATH,
    enabled: isFlowMusicTab,
  });

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

async function openPanelForTab(tabId, windowId) {
  if (!tabId) return;

  setSidePanelOptions({
    tabId,
    path: PANEL_PATH,
    enabled: true,
  });

  if (!chrome.sidePanel?.open) return;

  try {
    await chrome.sidePanel.open({ tabId });
  } catch (e) {
    if (windowId) {
      await chrome.sidePanel.open({ windowId }).catch(() => {});
    }
  }
}

async function setSidePanelBehavior() {
  if (!chrome.sidePanel?.setPanelBehavior) return;
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});
}

async function setSidePanelOptions(options) {
  if (!chrome.sidePanel?.setOptions) return;
  await chrome.sidePanel.setOptions(options).catch(() => {});
}

async function confirmOpenFlowMusic(tabId, windowId) {
  const url = new URL(chrome.runtime.getURL('confirm.html'));
  if (tabId) url.searchParams.set('tabId', String(tabId));
  if (windowId) url.searchParams.set('windowId', String(windowId));

  await chrome.windows.create({
    url: url.toString(),
    type: 'popup',
    width: 420,
    height: 220,
    focused: true,
  });
}

function isFlowMusicUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && FLOWMUSIC_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
}
