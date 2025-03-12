document.addEventListener('DOMContentLoaded', async () => {
  // 初始化页面
  initNavigation();
  await loadSettings();
  await loadInboxItems();
  initViewTableButton();
  calculateMaxItems();
});

// 导航功能
function initNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      // 移除所有活动状态
      navItems.forEach(i => i.classList.remove('active'));
      
      // 添加当前项目的活动状态
      item.classList.add('active');
      
      // 获取目标页面
      const targetPage = item.getAttribute('data-page');
      
      // 隐藏所有页面
      document.querySelectorAll('.page-container').forEach(page => {
        page.classList.add('hidden');
      });
      
      // 显示目标页面
      document.getElementById(`${targetPage}Page`).classList.remove('hidden');
    });
  });
}

// 加载设置
async function loadSettings() {
  // 加载已保存的设置
  const settings = await chrome.storage.sync.get(['appId', 'appSecret', 'baseId', 'baseUrl']);
  
  if (settings.appId) document.getElementById('appId').value = settings.appId;
  if (settings.appSecret) document.getElementById('appSecret').value = settings.appSecret;
  if (settings.baseUrl) document.getElementById('baseUrl').value = settings.baseUrl;
  if (settings.baseId) document.getElementById('baseId').value = settings.baseId;

  // 添加 URL 输入监听器
  document.getElementById('baseUrl').addEventListener('input', function(e) {
    const baseId = extractBaseId(e.target.value);
    document.getElementById('baseId').value = baseId || '';
  });

  // 添加验证按钮监听器
  document.getElementById('verifyButton').addEventListener('click', verifyConfiguration);

  // 保存设置
  document.getElementById('settingsForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const appId = document.getElementById('appId').value;
    const appSecret = document.getElementById('appSecret').value;
    const baseUrl = document.getElementById('baseUrl').value;
    const baseId = document.getElementById('baseId').value;

    if (!baseId) {
      showMessage('无法从 URL 中解析出 Base ID，请检查 URL 格式是否正确', 'error');
      return;
    }

    try {
      await chrome.storage.sync.set({ appId, appSecret, baseId, baseUrl });
      
      // 显示成功消息
      showMessage('设置已保存成功！', 'success');
      
      // 3秒后隐藏消息
      setTimeout(() => {
        document.getElementById('message').innerHTML = '';
        document.getElementById('message').className = 'message';
      }, 3000);

    } catch (error) {
      showMessage('保存设置失败: ' + error.message, 'error');
    }
  });
}

// 从 URL 中提取 Base ID
function extractBaseId(url) {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    const baseIndex = pathParts.indexOf('base');
    if (baseIndex !== -1 && baseIndex + 1 < pathParts.length) {
      return pathParts[baseIndex + 1];
    }
    return null;
  } catch (error) {
    return null;
  }
}

// 验证飞书配置
async function verifyConfiguration() {
  const appId = document.getElementById('appId').value;
  const appSecret = document.getElementById('appSecret').value;
  const baseUrl = document.getElementById('baseUrl').value;
  const baseId = document.getElementById('baseId').value;

  if (!appId || !appSecret || !baseId) {
    showMessage('请先填写完整的配置信息', 'error');
    return;
  }

  try {
    showMessage('正在验证配置...', 'info');
    
    // 获取访问令牌
    const tokenResponse = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        app_id: appId,
        app_secret: appSecret
      })
    });

    const tokenData = await tokenResponse.json();
    if (!tokenData.tenant_access_token) {
      throw new Error('获取访问令牌失败：' + (tokenData.msg || '未知错误'));
    }

    // 获取第一个数据表的信息
    const tableResponse = await fetch(`https://open.feishu.cn/open-apis/bitable/v1/apps/${baseId}/tables`, {
      headers: {
        'Authorization': `Bearer ${tokenData.tenant_access_token}`
      }
    });

    const tableData = await tableResponse.json();
    if (!tableData.data?.items?.length) {
      throw new Error('无法获取多维表格信息，请检查 Base ID 是否正确');
    }

    const firstTableId = tableData.data.items[0].table_id;

    // 获取字段信息
    const fieldsResponse = await fetch(`https://open.feishu.cn/open-apis/bitable/v1/apps/${baseId}/tables/${firstTableId}/fields`, {
      headers: {
        'Authorization': `Bearer ${tokenData.tenant_access_token}`
      }
    });

    const fieldsData = await fieldsResponse.json();
    if (!fieldsData.data?.items?.length) {
      throw new Error('无法获取字段信息');
    }

    // 检查必需的字段 - 使用更灵活的匹配方式
    const requiredFields = ['url', 'title', 'description', 'screenshot', 'content'];
    const existingFields = fieldsData.data.items.map(field => field.field_name.toLowerCase());
    
    // 检查每个必需字段是否存在（不区分大小写）
    const missingFields = [];
    for (const requiredField of requiredFields) {
      const found = existingFields.some(field => 
        field === requiredField.toLowerCase() || 
        field.includes(requiredField.toLowerCase())
      );
      
      if (!found) {
        // 转换为显示名称
        let displayName;
        switch(requiredField) {
          case 'url':
            displayName = 'URL';
            break;
          case 'title':
            displayName = 'Title';
            break;
          case 'description':
            displayName = 'Description';
            break;
          case 'screenshot':
            displayName = 'Screenshot';
            break;
          case 'content':
            displayName = 'Content';
            break;
          default:
            displayName = requiredField;
        }
        missingFields.push(displayName);
      }
    }

    if (missingFields.length > 0) {
      throw new Error(`缺少必需的字段：${missingFields.join(', ')}。请在多维表格中添加这些字段。`);
    }

    // 验证成功，自动保存配置
    await chrome.storage.sync.set({ appId, appSecret, baseId, baseUrl });
    
    showMessage('验证成功！配置已自动保存。', 'success');

  } catch (error) {
    showMessage(error.message || '验证失败，请检查配置是否正确', 'error');
  }
}

// 加载 Inbox 项目
async function loadInboxItems() {
  try {
    // 从 chrome.storage.local 获取保存的项目
    const result = await chrome.storage.local.get(['savedItems']);
    let savedItems = result.savedItems || [];
    
    // 获取最大项目数
    const maxItems = 500;
    
    // 如果超过最大项目数，只保留最新的项目
    if (savedItems.length > maxItems) {
      // 按时间戳降序排序（最新的在前面）
      savedItems.sort((a, b) => b.timestamp - a.timestamp);
      
      // 只保留最新的 maxItems 条
      savedItems = savedItems.slice(0, maxItems);
      
      // 更新存储
      await chrome.storage.local.set({ savedItems });
    }
    
    // 更新 Inbox 计数
    updateInboxCount(savedItems.length);
    
    // 显示项目
    displayInboxItems(savedItems);
    
  } catch (error) {
    console.error('加载 Inbox 项目失败:', error);
  }
}

// 显示 Inbox 项目
function displayInboxItems(items) {
  const inboxItemsContainer = document.getElementById('inboxItems');
  const emptyInbox = document.getElementById('emptyInbox');
  
  // 清空容器
  inboxItemsContainer.innerHTML = '';
  
  if (items.length === 0) {
    // 显示空状态
    emptyInbox.style.display = 'block';
    return;
  }
  
  // 隐藏空状态
  emptyInbox.style.display = 'none';
  
  // 按时间戳降序排序（最新的在前面）
  items.sort((a, b) => b.timestamp - a.timestamp);
  
  // 创建项目元素
  items.forEach(item => {
    const itemElement = createInboxItemElement(item);
    inboxItemsContainer.appendChild(itemElement);
  });
}

// 创建 Inbox 项目元素
function createInboxItemElement(item) {
  const itemElement = document.createElement('div');
  itemElement.className = 'inbox-item';
  itemElement.dataset.id = item.id;
  
  // 格式化保存日期
  const saveDate = new Date(item.timestamp);
  const formattedDate = saveDate.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
  
  // 获取网站图标
  const favicon = item.favicon || `https://www.google.com/s2/favicons?domain=${new URL(item.url).hostname}`;
  
  // 创建项目内容
  itemElement.innerHTML = `
    <img class="item-favicon" src="${favicon}" alt="网站图标" onerror="this.src='https://www.google.com/s2/favicons?domain=example.com'">
    <div class="item-content">
      <div class="item-title">${item.title}</div>
      <div class="item-url">${item.url}</div>
      <div class="item-time">收藏日期: ${formattedDate}</div>
    </div>
    <div class="item-actions">
      <button class="item-action open-action" title="打开链接">
        <span class="action-icon">🔗</span>
      </button>
      <button class="item-action delete-action" title="删除">
        <span class="action-icon">🗑️</span>
      </button>
    </div>
  `;
  
  // 添加事件监听器
  itemElement.querySelector('.open-action').addEventListener('click', () => {
    chrome.tabs.create({ url: item.url });
  });
  
  itemElement.querySelector('.delete-action').addEventListener('click', async () => {
    await deleteInboxItem(item.id);
  });
  
  return itemElement;
}

// 删除 Inbox 项目
async function deleteInboxItem(itemId) {
  try {
    // 获取当前保存的项目
    const result = await chrome.storage.local.get(['savedItems']);
    const savedItems = result.savedItems || [];
    
    // 过滤掉要删除的项目
    const updatedItems = savedItems.filter(item => item.id !== itemId);
    
    // 更新存储
    await chrome.storage.local.set({ savedItems: updatedItems });
    
    // 更新显示
    displayInboxItems(updatedItems);
    
    // 更新 Inbox 计数
    updateInboxCount(updatedItems.length);
    
  } catch (error) {
    console.error('删除 Inbox 项目失败:', error);
  }
}

// 更新 Inbox 计数
function updateInboxCount(count) {
  const inboxCountElement = document.getElementById('inboxCount');
  inboxCountElement.textContent = count;
  
  // 如果计数为 0，隐藏计数标记
  if (count === 0) {
    inboxCountElement.style.display = 'none';
  } else {
    inboxCountElement.style.display = 'flex';
  }
}

// 显示消息
function showMessage(text, type) {
  const messageEl = document.getElementById('message');
  messageEl.textContent = text;
  messageEl.className = `message ${type}`;
}

// 初始化查看多维表格按钮
function initViewTableButton() {
  const viewTableItem = document.getElementById('viewTableItem');
  
  viewTableItem.addEventListener('click', async () => {
    try {
      // 获取保存的 baseUrl
      const settings = await chrome.storage.sync.get(['baseUrl']);
      
      if (!settings.baseUrl) {
        showMessage('请先设置多维表格 URL', 'error');
        return;
      }
      
      // 打开多维表格
      chrome.tabs.create({ url: settings.baseUrl });
    } catch (error) {
      console.error('打开多维表格失败:', error);
      showMessage('打开多维表格失败', 'error');
    }
  });
}

// 计算浏览器可以存储的最大项目数
function calculateMaxItems() {
  // 固定最大项目数为 500 条
  const maxItems = 500;
  
  // 更新显示
  const maxItemCountElement = document.getElementById('maxItemCount');
  if (maxItemCountElement) {
    maxItemCountElement.textContent = maxItems;
  }
  
  return maxItems;
} 