document.getElementById('cancelBtn').addEventListener('click', () => {
  closeConfirmWindow();
});

document.getElementById('openBtn').addEventListener('click', () => {
  const button = document.getElementById('openBtn');
  button.disabled = true;
  button.textContent = 'Đang mở...';

  const params = new URLSearchParams(location.search);
  const openerTabId = Number(params.get('tabId'));
  const openerWindowId = Number(params.get('windowId'));
  const hasOpenerTab = Number.isInteger(openerTabId) && openerTabId > 0;
  const hasOpenerWindow = Number.isInteger(openerWindowId) && openerWindowId > 0;
  const createProperties = {
    url: 'https://www.flowmusic.app/',
    active: true,
  };
  if (hasOpenerWindow) {
    createProperties.windowId = openerWindowId;
  }

  if (hasOpenerTab) {
    chrome.sidePanel.setOptions({
      tabId: openerTabId,
      path: 'popup.html',
      enabled: true,
    }).catch(() => {});
  }

  const panelOpen = hasOpenerWindow
    ? chrome.sidePanel.open({ windowId: openerWindowId }).catch(() => null)
    : Promise.resolve(null);

  chrome.tabs.create(createProperties, (flowTab) => {
    chrome.sidePanel.setOptions({
      tabId: flowTab.id,
      path: 'popup.html',
      enabled: true,
    }).catch(() => {});

    panelOpen.then(() => {
      chrome.sidePanel.open({ tabId: flowTab.id }).catch(() => {
        chrome.sidePanel.open({ windowId: flowTab.windowId }).catch(() => {});
      });
    }).finally(closeConfirmWindow);
  });
});

function closeConfirmWindow() {
  chrome.windows.getCurrent((currentWindow) => {
    if (currentWindow?.id) chrome.windows.remove(currentWindow.id).catch(() => {});
  });
}
