// 提取页面信息
function extractPageInfo() {
  console.log('[飞藏] 开始提取页面信息');
  
  // 创建 Readability 对象
  const documentClone = document.cloneNode(true);
  const reader = new Readability(documentClone);
  const article = reader.parse();
  
  const pageInfo = {
    url: window.location.href,
    title: document.title,
    description: document.querySelector('meta[name="description"]')?.content || '',
    content: article ? article.content : '',  // HTML 格式的内容
    textContent: article ? article.textContent : ''  // 纯文本内容
  };
  
  console.log('[飞藏] 提取完成:', {
    title: pageInfo.title,
    hasContent: !!pageInfo.content
  });
  
  return pageInfo;
}

// 监听来自 popup 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getPageInfo') {
    console.log('[飞藏] 收到获取页面信息请求');
    const info = extractPageInfo();
    console.log('[飞藏] 返回页面信息');
    sendResponse(info);
  }
}); 