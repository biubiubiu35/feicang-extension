class FeishuAPI {
  constructor() {
    this.baseURL = 'https://open.feishu.cn/open-apis';
    this.token = null;
  }

  async getAccessToken() {
    const { appId, appSecret } = await chrome.storage.sync.get(['appId', 'appSecret']);
    
    if (!appId || !appSecret) {
      throw new Error('请先配置飞书应用凭证');
    }

    const response = await fetch(`${this.baseURL}/auth/v3/tenant_access_token/internal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        app_id: appId,
        app_secret: appSecret,
      }),
    });

    const data = await response.json();
    if (data.code !== 0) {
      throw new Error(data.msg);
    }

    this.token = data.tenant_access_token;
    return this.token;
  }

  async saveToBase(pageData) {
    const token = await this.getAccessToken();
    const { baseId } = await chrome.storage.sync.get(['baseId']);

    if (!baseId) {
      throw new Error('请先配置多维表格 Base ID');
    }

    const response = await fetch(`${this.baseURL}/bitable/v1/apps/${baseId}/tables/records`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fields: {
          URL: pageData.url,
          Title: pageData.title,
          Description: pageData.description,
          Screenshot: pageData.screenshot,
          SavedAt: pageData.timestamp,
        },
      }),
    });

    const data = await response.json();
    if (data.code !== 0) {
      throw new Error(data.msg);
    }

    return data;
  }
}

export const feishuAPI = new FeishuAPI(); 