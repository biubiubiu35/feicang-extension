import { feishuAPI } from './api.js';

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'savePageInfo') {
    handleSavePageInfo(request.data)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

async function handleSavePageInfo(data) {
  try {
    // 保存到飞书多维表格
    const result = await feishuAPI.saveToBase(data);
    
    // 同时保存到本地存储作为备份
    const { pages = [] } = await chrome.storage.local.get('pages');
    pages.push(data);
    await chrome.storage.local.set({ pages });
    
    return result;
  } catch (error) {
    console.error('保存失败:', error);
    throw error;
  }
} 