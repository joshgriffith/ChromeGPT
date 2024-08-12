chrome.action.onClicked.addListener(async (tab) => {
    chrome.scripting.executeScript({
        target: {tabId: tab.id},
        files: ['content.js']
    });
});

chrome.commands.onCommand.addListener(function(command) {
    if (command === "trigger-action") {
      chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        chrome.scripting.executeScript({
            target: {tabId: tabs[0].id},
            files: ['content.js']
        });
      });
    }
});

chrome.runtime.onInstalled.addListener(function() {
  chrome.contextMenus.create({
    id: "chromeGptContextMenu",
    title: "Chrome GPT",
    contexts: ["selection", "page"]
  });
});

chrome.contextMenus.onClicked.addListener(function(info, tab) {
  if (info.menuItemId === "chromeGptContextMenu") {
    chrome.scripting.executeScript({
      target: {tabId: tab.id},
      files: ['content.js']
    });
  }
});