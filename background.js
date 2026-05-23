const FLOWMUSIC_HOSTS = new Set(['flowmusic.app', 'www.flowmusic.app']);
const PANEL_PATH = 'popup.html';
const FLOWMUSIC_URL = 'https://www.flowmusic.app/';
let pendingConfirm = null;

chrome.runtime.onInstalled.addListener(async () => {
  await setSidePanelBehavior();
  refreshAllTabs();
});

chrome.runtime.onStartup.addListener(refreshAllTabs);

chrome.action.onClicked.addListener(async (tab) => {
  if (isFlowMusicUrl(tab?.url)) {
    await openPanelForTab(tab.id, tab.windowId);
    return;
  }

  const shouldOpen = await confirmOpenFlowMusic(tab?.id);
  if (!shouldOpen) return;

  const createProperties = {
    url: FLOWMUSIC_URL,
    active: true,
  };
  if (tab?.windowId) createProperties.windowId = tab.windowId;

  const flowTab = await chrome.tabs.create(createProperties);

  await setSidePanelOptions({
    tabId: flowTab.id,
    path: PANEL_PATH,
    enabled: true,
  });

  await openPanelForTab(flowTab.id, flowTab.windowId);
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
  refreshTab(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading' || changeInfo.url || tab.url) {
    refreshTab(tabId, tab);
  }
});

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type !== 'OPEN_FLOWMUSIC_CONFIRM_RESULT' || !pendingConfirm) return;

  const { resolve, windowId } = pendingConfirm;
  pendingConfirm = null;
  resolve(Boolean(message.accepted));
  if (windowId) chrome.windows.remove(windowId).catch(() => {});
});

async function refreshAllTabs() {
  const tabs = await chrome.tabs.query({});
  await Promise.all(tabs.map(tab => refreshTab(tab.id, tab)));
}

async function refreshTab(tabId, tab) {
  if (!tabId) return;

  const currentTab = tab?.url ? tab : await chrome.tabs.get(tabId).catch(() => null);
  const enabled = isFlowMusicUrl(currentTab?.url);

  await setSidePanelOptions({
    tabId,
    path: PANEL_PATH,
    enabled,
  });

  if (enabled) {
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

  await setSidePanelOptions({
    tabId,
    path: PANEL_PATH,
    enabled: true,
  });

  if (!chrome.sidePanel?.open) return;

  await chrome.sidePanel.open({ tabId }).catch(async () => {
    if (windowId) {
      await chrome.sidePanel.open({ windowId }).catch(() => {});
    }
  });
}

async function setSidePanelBehavior() {
  if (!chrome.sidePanel?.setPanelBehavior) return;
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
}

async function setSidePanelOptions(options) {
  if (!chrome.sidePanel?.setOptions) return;
  await chrome.sidePanel.setOptions(options).catch(() => {});
}

async function confirmOpenFlowMusic(tabId) {
  if (!tabId) return true;

  const injected = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => window.confirm('FlowMusic Auto Prompt chỉ hoạt động trên flowmusic.app. Bạn có muốn mở FlowMusic ngay bây giờ không?'),
  }).catch(() => null);

  if (injected) {
    return Boolean(injected[0]?.result);
  }

  return confirmInExtensionWindow();
}

function confirmInExtensionWindow() {
  return new Promise(async (resolve) => {
    if (pendingConfirm) {
      pendingConfirm.resolve(false);
      pendingConfirm = null;
    }

    const confirmWindow = await chrome.windows.create({
      url: chrome.runtime.getURL('confirm.html'),
      type: 'popup',
      width: 420,
      height: 220,
      focused: true,
    });

    const timeoutId = setTimeout(() => {
      if (!pendingConfirm) return;
      pendingConfirm = null;
      resolve(false);
      if (confirmWindow.id) chrome.windows.remove(confirmWindow.id).catch(() => {});
    }, 60000);

    const onRemoved = (windowId) => {
      if (windowId !== confirmWindow.id || !pendingConfirm) return;
      clearTimeout(timeoutId);
      pendingConfirm = null;
      chrome.windows.onRemoved.removeListener(onRemoved);
      resolve(false);
    };

    chrome.windows.onRemoved.addListener(onRemoved);
    pendingConfirm = {
      windowId: confirmWindow.id,
      resolve: (value) => {
        clearTimeout(timeoutId);
        chrome.windows.onRemoved.removeListener(onRemoved);
        resolve(value);
      },
    };
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
