/**
 * popup.js - Chrome 扩展弹出窗口的主要脚本
 * 
 * 该脚本负责处理扩展弹出窗口的所有功能，包括：
 * - 获取当前页面信息（URL、标题、描述）
 * - 捕获页面截图
 * - 将数据保存到飞书
 * - 提供用户反馈（成功/错误提示）
 * - 日志收集和显示
 */

import { feishuClient } from './utils/feishu.js';

/**
 * 配置常量 - 集中管理可配置参数
 */
const CONFIG = Object.freeze({
  // 截图配置
  SCREENSHOT: {
    FORMAT: 'jpeg',
    QUALITY: 80,
    MIN_LENGTH: 100 // 最小有效截图数据长度
  },
  // 动画配置
  ANIMATION: {
    DOM_UPDATE_DELAY: 10, // DOM更新后显示动画的延迟(ms)
    SUCCESS_DISPLAY_TIME: 1500 // 成功提示显示时间(ms)
  },
  // 文本截断配置
  TEXT: {
    MAX_DESCRIPTION_LENGTH: 200
  }
});

/**
 * UI 元素管理器 - 集中管理 DOM 元素引用
 */
const UI = {
  elements: {}, // 存储 DOM 元素引用的缓存
  
  /**
   * 获取 DOM 元素，优先从缓存获取
   * @param {string} id - 元素 ID
   * @returns {HTMLElement} DOM 元素
   */
  getById(id) {
    if (!this.elements[id]) {
      this.elements[id] = document.getElementById(id);
    }
    return this.elements[id];
  },
  
  /**
   * 获取 DOM 元素，使用选择器
   * @param {string} selector - CSS 选择器
   * @returns {HTMLElement} DOM 元素
   */
  query(selector) {
    const key = `query_${selector}`;
    if (!this.elements[key]) {
      this.elements[key] = document.querySelector(selector);
    }
    return this.elements[key];
  },
  
  /**
   * 清除缓存的 DOM 元素引用
   */
  clearCache() {
    this.elements = {};
  }
};

/**
 * 状态管理器 - 管理应用状态
 */
const AppState = {
  initialized: false,
  
  /**
   * 设置初始化状态
   * @param {boolean} value - 初始化状态值
   */
  setInitialized(value) {
    this.initialized = value;
  },
  
  /**
   * 获取初始化状态
   * @returns {boolean} 初始化状态
   */
  isInitialized() {
    return this.initialized;
  }
};

/**
 * 日志收集器 - 用于收集和格式化控制台日志
 * 重写原生 console 方法以便在界面中显示日志信息
 */
const LogCollector = {
  // 存储所有日志条目
  logs: [],
  // 保存原始控制台方法的引用
  originalConsole: {
    log: console.log,
    error: console.error,
    warn: console.warn,
    info: console.info
  },
  
  /**
   * 初始化日志收集器，重写 console 方法
   */
  init() {
    // 创建日志收集函数工厂
    const createLogFunction = (type, originalFn) => {
      return (...args) => {
        this.logs.push({ type, time: new Date(), args });
        originalFn.apply(console, args);
      };
    };
    
    // 使用工厂函数创建各种日志方法
    console.log = createLogFunction('log', this.originalConsole.log);
    console.error = createLogFunction('error', this.originalConsole.error);
    console.warn = createLogFunction('warn', this.originalConsole.warn);
    console.info = createLogFunction('info', this.originalConsole.info);
  },
  
  /**
   * 获取格式化的日志文本
   * @returns {string} 格式化后的日志文本
   */
  getFormattedLogs() {
    if (this.logs.length === 0) {
      return '暂无日志';
    }
    
    // 使用数组 join 而不是字符串拼接，提高性能
    return this.logs.map(log => {
      const time = log.time.toLocaleTimeString();
      const type = log.type.toUpperCase();
      
      // 处理对象类型的参数，转换为字符串
      const args = log.args.map(arg => {
        if (arg === null) return 'null';
        if (arg === undefined) return 'undefined';
        
        if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg, null, 2);
          } catch (e) {
            return String(arg);
          }
        }
        return String(arg);
      }).join(' ');
      
      return `[${time}] [${type}] ${args}`;
    }).join('\n');
  },
  
  /**
   * 清空日志记录
   */
  clear() {
    this.logs = [];
  }
};

/**
 * 错误处理器 - 处理和显示错误信息
 */
const ErrorHandler = {
  /**
   * 显示错误信息
   * @param {Error} error - 错误对象
   * @param {string} context - 错误发生的上下文
   */
  showError(error, context = '') {
    const errorContainer = UI.getById('errorContainer');
    const errorMessage = this.formatErrorMessage(error, context);
    
    errorContainer.innerHTML = errorMessage;
    // 保留日志链接按钮
    errorContainer.appendChild(UI.getById('showLogsButton'));
    errorContainer.style.display = 'block';
    
    // 显示日志按钮
    UI.getById('showLogsButton').style.display = 'inline-block';
    
    console.error(`${context} 错误:`, error);
  },
  
  /**
   * 清除错误信息
   */
  clearError() {
    const errorContainer = UI.getById('errorContainer');
    errorContainer.style.display = 'none';
    errorContainer.innerHTML = '';
    // 重新添加日志链接按钮，但保持隐藏
    errorContainer.appendChild(UI.getById('showLogsButton'));
  },
  
  /**
   * 格式化错误消息
   * @param {Error} error - 错误对象
   * @param {string} context - 错误发生的上下文
   * @returns {string} 格式化后的错误消息
   */
  formatErrorMessage(error, context) {
    const errorParts = [`${context} 失败: ${error.message}`];
    
    if (error.details) {
      errorParts.push(`<br><br><strong>详细信息:</strong><br>${error.details}`);
    }
    
    if (error.code) {
      errorParts.push(`<br><strong>错误代码:</strong> ${error.code}`);
    }
    
    errorParts.push(`<br><br><small>点击下方"查看日志"按钮获取更多信息</small>`);
    
    return errorParts.join('');
  }
};

/**
 * UI 组件工厂 - 负责创建和管理 UI 组件
 */
const UIFactory = {
  /**
   * 创建日志查看模态框
   * @returns {HTMLElement|undefined} 创建的模态框元素或 undefined（如果已存在）
   */
  createLogsModal() {
    // 检查是否已存在模态框，避免重复创建
    if (document.getElementById('logsModal')) {
      return document.getElementById('logsModal');
    }
    
    // 使用 DocumentFragment 减少 DOM 操作次数
    const fragment = document.createDocumentFragment();
    
    // 创建模态框容器
    const modal = document.createElement('div');
    modal.id = 'logsModal';
    modal.className = 'logs-modal';
    modal.style.display = 'none';
    
    // 创建模态框内容容器
    const content = document.createElement('div');
    content.className = 'logs-content';
    
    // 创建模态框头部
    const header = document.createElement('div');
    header.className = 'logs-header';
    
    // 创建标题
    const title = document.createElement('h3');
    title.textContent = '操作日志';
    
    // 创建关闭按钮
    const closeButton = document.createElement('button');
    closeButton.className = 'logs-close';
    closeButton.textContent = '×';
    closeButton.onclick = () => {
      modal.style.display = 'none';
    };
    
    // 创建日志内容区域
    const body = document.createElement('div');
    body.id = 'logsBody';
    body.className = 'logs-body';
    
    // 组装模态框结构
    header.appendChild(title);
    header.appendChild(closeButton);
    content.appendChild(header);
    content.appendChild(body);
    modal.appendChild(content);
    
    // 添加到 fragment
    fragment.appendChild(modal);
    
    // 一次性添加到页面
    document.body.appendChild(fragment);
    
    // 点击模态框外部区域关闭模态框
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.style.display = 'none';
      }
    });
    
    return modal;
  },
  
  /**
   * 创建成功反馈元素
   * @returns {HTMLElement} 成功反馈容器元素
   */
  createSuccessFeedback() {
    // 使用 DocumentFragment 减少 DOM 操作次数
    const fragment = document.createDocumentFragment();
    
    // 创建成功反馈容器
    const successContainer = document.createElement('div');
    successContainer.className = 'success-feedback';
    
    // 创建成功图标
    const successIcon = document.createElement('div');
    successIcon.className = 'success-icon';
    successIcon.innerHTML = `
      <svg width="60" height="60" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M22 11.08V12C21.9988 14.1564 21.3005 16.2547 20.0093 17.9818C18.7182 19.709 16.9033 20.9725 14.8354 21.5839C12.7674 22.1953 10.5573 22.1219 8.53447 21.3746C6.51168 20.6273 4.78465 19.2461 3.61096 17.4371C2.43727 15.628 1.87979 13.4881 2.02168 11.3363C2.16356 9.18455 2.99721 7.13631 4.39828 5.49706C5.79935 3.85781 7.69279 2.71537 9.79619 2.24013C11.8996 1.7649 14.1003 1.98232 16.07 2.85999" stroke="#34C759" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M22 4L12 14.01L9 11.01" stroke="#34C759" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
    
    // 创建成功文本
    const successText = document.createElement('div');
    successText.className = 'success-text';
    successText.textContent = '保存成功！';
    
    // 组装成功反馈
    successContainer.appendChild(successIcon);
    successContainer.appendChild(successText);
    
    // 添加到 fragment
    fragment.appendChild(successContainer);
    
    // 一次性添加到页面
    document.body.appendChild(fragment);
    
    return successContainer;
  }
};

/**
 * 页面数据处理器 - 处理页面数据获取和处理
 */
const PageDataHandler = {
  /**
   * 获取页面描述信息的函数
   * 在 content script 中执行
   * @returns {Function} 获取描述的函数
   */
  getDescriptionFunction() {
    return function getPageInfo(maxLength = 200) {
      // 获取页面描述
      function getDescription() {
        // 尝试从多种 meta 标签中获取描述
        const selectors = [
          'meta[name="description"]',
          'meta[property="og:description"]',
          'meta[name="twitter:description"]',
          'meta[itemprop="description"]'
        ];
        
        // 遍历所有可能的选择器
        for (const selector of selectors) {
          const meta = document.querySelector(selector);
          if (meta?.content) return meta.content;
        }
        
        // 如果没有 meta 描述，尝试获取第一段文本
        const firstParagraph = document.querySelector('p');
        if (firstParagraph) {
          const text = firstParagraph.textContent.trim();
          return text.length > maxLength 
            ? text.slice(0, maxLength) + '...' 
            : text;
        }
        
        return '';
      }

      // 返回页面基本信息
      return {
        url: window.location.href,
        title: document.title,
        description: getDescription(),
        favicon: document.querySelector('link[rel*="icon"]')?.href
      };
    };
  },
  
  /**
   * 验证数据有效性
   * @param {Object} data - 要验证的数据
   * @throws {Error} 如果数据无效则抛出错误
   */
  validateData(data) {
    if (!data.url) {
      throw new Error('URL 不能为空');
    }
    
    if (!data.title) {
      throw new Error('标题不能为空');
    }
    
    // 验证截图数据是否有效
    if (!data.screenshot || data.screenshot.length < CONFIG.SCREENSHOT.MIN_LENGTH) {
      throw new Error('截图数据无效或为空');
    }
  }
};

/**
 * UI 交互控制器 - 处理 UI 交互逻辑
 */
const UIController = {
  /**
   * 显示日志模态框
   */
  showLogsModal() {
    // 获取或创建模态框
    const modal = UIFactory.createLogsModal();
    
    // 更新日志内容
    const logsBody = UI.getById('logsBody');
    if (logsBody) {
      logsBody.textContent = LogCollector.getFormattedLogs();
    }
    
    // 显示模态框
    modal.style.display = 'flex';
  },
  
  /**
   * 显示成功反馈动画
   * @returns {Promise} 动画完成后解决的 Promise
   */
  showSuccessFeedback() {
    const successContainer = UIFactory.createSuccessFeedback();
    
    // 添加显示动画类（延迟确保 DOM 已更新）
    setTimeout(() => {
      successContainer.classList.add('show');
    }, CONFIG.ANIMATION.DOM_UPDATE_DELAY);
    
    // 指定时间后关闭弹窗
    return new Promise(resolve => {
      setTimeout(() => {
        // 可选：移除元素以清理 DOM
        if (successContainer.parentNode) {
          successContainer.parentNode.removeChild(successContainer);
        }
        resolve();
      }, CONFIG.ANIMATION.SUCCESS_DISPLAY_TIME);
    });
  },
  
  /**
   * 更新加载状态
   * @param {string} message - 状态消息
   * @param {boolean} isError - 是否为错误状态
   */
  updateLoadingState(message, isError = false) {
    const loadingIndicator = UI.query('.loading-indicator');
    if (loadingIndicator) {
      loadingIndicator.textContent = message;
      if (isError) {
        loadingIndicator.style.color = '#d32f2f';
      }
    }
  },
  
  /**
   * 更新按钮状态
   * @param {string} buttonId - 按钮 ID
   * @param {boolean} isLoading - 是否为加载状态
   * @param {string} loadingText - 加载状态文本
   * @param {string} normalText - 正常状态文本
   */
  updateButtonState(buttonId, isLoading, loadingText = '保存中...', normalText = '保存 (Enter)') {
    const button = UI.getById(buttonId);
    if (button) {
      button.disabled = isLoading;
      button.textContent = isLoading ? loadingText : normalText;
    }
  },
  
  /**
   * 填充表单数据
   * @param {Object} data - 表单数据
   */
  fillFormData(data) {
    if (!data) return;
    
    // 处理标题和描述
    if (data.title) {
      UI.getById('title').value = data.title;
    }
    
    if (data.description) {
      UI.getById('description').value = data.description;
    }
    
    // 处理URL - 现在是显示为链接而不是输入框
    if (data.url) {
      const urlElement = UI.getById('url');
      urlElement.textContent = data.url;
      urlElement.setAttribute('data-url', data.url);
      
      // 存储URL到隐藏字段
      UI.getById('urlStorage').value = data.url;
      
      // 添加点击复制功能
      urlElement.addEventListener('click', () => {
        this.copyUrlToClipboard(data.url, urlElement);
      });
    }
  },
  
  /**
   * 复制URL到剪贴板并显示反馈
   * @param {string} url - 要复制的URL
   * @param {HTMLElement} element - URL显示元素
   */
  copyUrlToClipboard(url, element) {
    navigator.clipboard.writeText(url)
      .then(() => {
        // 显示复制成功提示
        const originalText = element.textContent;
        element.textContent = '已复制!';
        
        // 添加复制成功的视觉反馈
        element.style.color = '#34C759';
        element.style.fontWeight = 'bold';
        
        // 一段时间后恢复原始状态
        setTimeout(() => {
          element.textContent = originalText;
          element.style.color = '';
          element.style.fontWeight = '';
        }, 1000);
      })
      .catch(err => {
        console.error('复制失败:', err);
        ErrorHandler.showError(new Error('无法复制URL到剪贴板'), '复制');
      });
  }
};

/**
 * 检查 URL 是否已经保存过
 * @param {string} url - 要检查的 URL
 * @returns {Promise<Object|null>} 如果已存在返回保存的项目，否则返回 null
 */
async function checkUrlExists(url) {
  try {
    const result = await chrome.storage.local.get(['savedItems']);
    const savedItems = result.savedItems || [];
    return savedItems.find(item => item.url === url) || null;
  } catch (error) {
    console.error('检查 URL 失败:', error);
    return null;
  }
}

/**
 * 显示重复保存提示
 * @param {Object} existingItem - 已存在的项目
 */
function showDuplicateNotification(existingItem) {
  const successContainer = UIFactory.createSuccessFeedback();
  
  // 修改成功反馈的内容为重复提示
  const iconElement = successContainer.querySelector('.success-icon');
  const textElement = successContainer.querySelector('.success-text');
  
  // 修改图标为信息图标
  iconElement.innerHTML = `
    <svg width="60" height="60" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="#2196F3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M12 16V12" stroke="#2196F3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M12 8H12.01" stroke="#2196F3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;
  
  // 修改文本
  textElement.textContent = '已在收藏列表中';
  textElement.style.color = '#2196F3';
  
  // 添加显示动画类
  setTimeout(() => {
    successContainer.classList.add('show');
  }, CONFIG.ANIMATION.DOM_UPDATE_DELAY);
  
  // 指定时间后关闭弹窗
  return new Promise(resolve => {
    setTimeout(() => {
      if (successContainer.parentNode) {
        successContainer.parentNode.removeChild(successContainer);
      }
      resolve();
    }, CONFIG.ANIMATION.SUCCESS_DISPLAY_TIME);
  });
}

/**
 * 初始化应用
 * 设置事件监听器和初始状态
 */
async function initializeApp() {
  if (AppState.isInitialized()) {
    return;
  }
  AppState.setInitialized(true);

  // 添加调试入口点击事件
  UI.getById('debugEntry').addEventListener('click', async () => {
    try {
      // 获取当前标签页
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // 发送消息给 content script 获取页面信息
      const response = await chrome.tabs.sendMessage(tab.id, { 
        action: 'getPageInfo',
        debug: true
      });
      
      // 创建调试窗口
      showDebugWindow(response);
    } catch (error) {
      console.error('获取调试信息失败:', error);
      ErrorHandler.showError(error, '调试');
    }
  });

  // 修改凭证检查逻辑
  const credentials = await chrome.storage.sync.get(['appId', 'appSecret', 'baseId']);
  if (!credentials.appId || !credentials.appSecret || !credentials.baseId) {
    // 显示配置引导
    showConfigurationGuide();
    return;
  }

  // 获取 UI 元素引用
  const loadingIndicator = UI.query('.loading-indicator');
  const screenshotImg = UI.getById('screenshot');
  const saveButton = UI.getById('saveButton');
  
  try {
    // 获取当前活动标签页
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      throw new Error('无法获取当前标签页');
    }

    // 更新加载状态提示
    UIController.updateLoadingState('获取页面信息...');
    
    // 获取页面信息
    const pageInfo = await chrome.tabs.sendMessage(tab.id, { 
      action: 'getPageInfo'
    });

    // 更新加载状态提示
    UIController.updateLoadingState('获取截图...');
    
    // 获取页面截图
    const screenshot = await chrome.tabs.captureVisibleTab(null, {
      format: CONFIG.SCREENSHOT.FORMAT,
      quality: CONFIG.SCREENSHOT.QUALITY
    });

    // 填充表单字段
    UIController.fillFormData(pageInfo);

    // 显示正文内容
    const contentPreview = UI.getById('contentPreview');
    if (pageInfo.content) {
      // 使用 HTML 内容，保留原始格式
      contentPreview.innerHTML = pageInfo.content;
    } else {
      contentPreview.textContent = '未提取到正文内容';
    }

    // 设置截图加载成功的处理
    screenshotImg.onload = () => {
      screenshotImg.classList.add('loaded');
      loadingIndicator.style.display = 'none';
    };
    
    // 设置截图加载失败的处理
    screenshotImg.onerror = () => {
      UIController.updateLoadingState('截图加载失败', true);
    };
    
    // 设置截图源
    screenshotImg.src = screenshot;

    // 设置保存按钮点击事件处理
    saveButton.addEventListener('click', handleSaveButtonClick);
    
    // 设置回车键触发保存
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey) {
        handleSaveButtonClick();
      }
    });

    // 更新保存按钮文字，显示快捷键
    saveButton.textContent = '保存 (Enter)';

    // 设置按钮点击事件 - 打开扩展选项页
    UI.getById('settingsButton').addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });
    
    // 日志查看按钮点击事件 - 显示日志模态框
    UI.getById('showLogsButton').addEventListener('click', (e) => {
      e.preventDefault(); // 阻止默认链接行为
      UIController.showLogsModal();
    });
    
    // 初始隐藏日志按钮
    UI.getById('showLogsButton').style.display = 'none';

  } catch (error) {
    // 处理初始化错误
    console.error('初始化错误:', error);
    ErrorHandler.showError(error, '初始化');
    UIController.updateLoadingState(`错误: ${error.message}`, true);
  }
}

/**
 * 显示配置引导界面
 */
function showConfigurationGuide() {
  const container = UI.query('.container');
  if (container) {
    // 清空现有内容
    container.innerHTML = `
      <div class="config-guide">
        <div class="guide-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 15H12.01M12 12V9M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" 
              stroke="#2196F3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <h3>需要配置飞书凭证</h3>
        <p>请先完成必要的飞书配置才能使用保存功能。</p>
        <button id="goToSettings" class="primary-button">
          前往配置
          <span class="button-icon">→</span>
        </button>
      </div>
    `;

    // 添加配置按钮点击事件
    const settingsButton = UI.getById('goToSettings');
    if (settingsButton) {
      settingsButton.addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
      });
    }

    // 添加样式
    const style = document.createElement('style');
    style.textContent = `
      .config-guide {
        text-align: center;
        padding: 20px;
      }
      .guide-icon {
        margin-bottom: 16px;
      }
      .config-guide h3 {
        margin: 0 0 8px;
        color: #333;
      }
      .config-guide p {
        margin: 0 0 20px;
        color: #666;
      }
      .primary-button {
        background: #2196F3;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        transition: background 0.2s;
      }
      .primary-button:hover {
        background: #1976D2;
      }
      .button-icon {
        font-size: 18px;
      }
    `;
    document.head.appendChild(style);
  }
}

/**
 * 处理保存按钮点击事件
 */
async function handleSaveButtonClick() {
  try {
    // 清除之前的错误信息
    ErrorHandler.clearError();

    // 更新按钮状态为加载中
    UIController.updateButtonState('saveButton', true);

    // 收集表单数据
    const data = {
      url: UI.getById('urlStorage').value,
      title: UI.getById('title').value,
      description: UI.getById('description').value,
      screenshot: UI.getById('screenshot').src,
      content: UI.getById('contentPreview').textContent  // 添加正文内容
    };

    // 检查 URL 是否已存在
    const existingItem = await checkUrlExists(data.url);
    if (existingItem) {
      // 显示重复提示
      const container = UI.query('.container');
      if (container) {
        container.style.opacity = '0.6';
      }
      
      // 等待提示动画完成后关闭界面
      await showDuplicateNotification(existingItem);
      window.close();
      return;
    }

    // 验证数据有效性
    PageDataHandler.validateData(data);

    // 调用飞书 API 保存数据
    console.log('调用 savePage 方法...');
    const saveResult = await feishuClient.savePage(data);
    console.log('保存成功!', saveResult);

    // 保存到 Inbox
    await saveToInbox({
      id: Date.now().toString(),
      url: data.url,
      title: data.title,
      description: data.description,
      favicon: `https://www.google.com/s2/favicons?domain=${new URL(data.url).hostname}`,
      timestamp: Date.now(),
      recordId: saveResult?.record?.id || null
    });

    // 显示成功反馈
    const container = UI.query('.container');
    if (container) {
      container.style.opacity = '0.6';
    }
    
    // 等待成功反馈动画完成
    await UIController.showSuccessFeedback();
    
    // 保存成功后关闭弹窗
    window.close();
  } catch (error) {
    // 显示错误信息
    ErrorHandler.showError(error, '保存');
  } finally {
    // 恢复按钮状态
    UIController.updateButtonState('saveButton', false);
  }
}

/**
 * 保存页面到 Inbox
 * @param {Object} item - 要保存的项目
 */
async function saveToInbox(item) {
  try {
    // 从 chrome.storage.local 获取已保存的项目
    const result = await chrome.storage.local.get(['savedItems']);
    const savedItems = result.savedItems || [];
    
    // 添加新项目
    savedItems.push(item);
    
    // 过滤掉超过 24 小时的项目
    const currentTime = Date.now();
    const validItems = savedItems.filter(item => {
      const itemAge = currentTime - item.timestamp;
      return itemAge < 24 * 60 * 60 * 1000; // 24小时（毫秒）
    });
    
    // 限制最大条数为 500
    const maxItems = 500;
    if (validItems.length > maxItems) {
      // 按时间戳降序排序（最新的在前面）
      validItems.sort((a, b) => b.timestamp - a.timestamp);
      // 只保留最新的 maxItems 条
      validItems.splice(maxItems);
    }
    
    // 更新存储
    await chrome.storage.local.set({ savedItems: validItems });
    console.log('已保存到 Inbox:', item.title);
    
  } catch (error) {
    console.error('保存到 Inbox 失败:', error);
    // 这里我们不抛出错误，因为这不应该阻止主要的保存流程
  }
}

/**
 * 显示调试窗口
 * @param {Object} data - 页面解析数据
 */
function showDebugWindow(data) {
  // 移除已存在的调试窗口
  const existingWindow = document.querySelector('.debug-window');
  if (existingWindow) {
    existingWindow.remove();
  }
  
  // 创建新的调试窗口
  const debugWindow = document.createElement('div');
  debugWindow.className = 'debug-window';
  
  // 格式化内容
  const content = data.content || '未提取到内容';
  const formattedContent = content.split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n\n');
  
  // 设置窗口内容
  debugWindow.innerHTML = `
    <div class="debug-header">
      <strong>页面标题:</strong> ${data.title}<br>
      <strong>URL:</strong> ${data.url}<br>
      <strong>描述长度:</strong> ${data.description?.length || 0} 字符<br>
      <strong>正文长度:</strong> ${content.length} 字符
    </div>
    <div class="debug-content">
      <strong>提取的正文内容:</strong>
      <pre>${formattedContent}</pre>
    </div>
    <button class="close-button">关闭</button>
  `;
  
  // 添加关闭按钮功能
  debugWindow.querySelector('.close-button').addEventListener('click', () => {
    debugWindow.remove();
  });
  
  // 添加点击外部区域关闭功能
  debugWindow.addEventListener('click', (e) => {
    if (e.target === debugWindow) {
      debugWindow.remove();
    }
  });
  
  // 添加到页面
  document.body.appendChild(debugWindow);
}

// 初始化日志收集器
LogCollector.init();

// 页面加载完成后初始化应用
document.addEventListener('DOMContentLoaded', initializeApp);

/**
 * 页面卸载时的清理逻辑
 * 重置初始化状态，确保下次打开时能重新初始化
 */
window.addEventListener('unload', () => {
  AppState.setInitialized(false);
  UI.clearCache();
}); 