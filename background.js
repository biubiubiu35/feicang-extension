// 监听来自 popup 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'savePageInfo') {
    savePageInfo(request.data)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // 保持消息通道开启，等待异步响应
  }
});

// 保存页面信息到 Chrome Storage
async function savePageInfo(data) {
  try {
    // 获取现有数据
    const result = await chrome.storage.local.get('pages');
    const pages = result.pages || [];
    
    // 添加新数据
    pages.push(data);
    
    // 保存更新后的数据
    await chrome.storage.local.set({ pages });
    
    return true;
  } catch (error) {
    console.error('保存失败:', error);
    throw error;
  }
} 