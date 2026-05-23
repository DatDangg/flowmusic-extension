document.getElementById('cancelBtn').addEventListener('click', () => {
  sendResult(false);
});

document.getElementById('openBtn').addEventListener('click', () => {
  sendResult(true);
});

function sendResult(accepted) {
  chrome.runtime.sendMessage({
    type: 'OPEN_FLOWMUSIC_CONFIRM_RESULT',
    accepted,
  });
}
