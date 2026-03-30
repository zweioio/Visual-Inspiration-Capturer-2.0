/**
 * background.js
 * Extension 的 Service Worker
 */

chrome.runtime.onInstalled.addListener(() => {
  console.log('Visual Inspiration Capturer 插件安装成功！🎉');
});

// 监听扩展图标点击事件
chrome.action.onClicked.addListener((tab) => {
  // 禁止在 chrome:// 等系统页面注入
  if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:')) {
    console.warn("无法在浏览器系统页面使用此扩展");
    return;
  }

  // 先尝试直接发送消息
  chrome.tabs.sendMessage(tab.id, { action: "togglePanel" }, (response) => {
    // 如果发生错误（且确实是没有注入导致的问题），说明 content script 没有准备好
    if (chrome.runtime.lastError && !response) {
      console.log("消息发送失败，尝试动态注入:", chrome.runtime.lastError.message);
      
      // 动态注入脚本
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["jszip.min.js", "html2canvas.min.js", "content.js"]
      }).then(() => {
        // 动态注入样式
        return chrome.scripting.insertCSS({
          target: { tabId: tab.id },
          files: ["panel.css"]
        });
      }).then(() => {
        // 注入完成后，等待一小会儿确保脚本执行完毕，再次发送消息
        setTimeout(() => {
          chrome.tabs.sendMessage(tab.id, { action: "togglePanel" }, () => {
             // 忽略第二次的错误
             if (chrome.runtime.lastError) {}
          });
        }, 150);
      }).catch(err => {
        console.error("动态注入彻底失败:", err);
      });
    }
  });
});

// 处理跨域请求、下载等任务
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'downloadFile') {
    chrome.downloads.download({
      url: request.url,
      filename: request.filename,
      saveAs: false
    });
  }
});
