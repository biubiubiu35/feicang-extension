export class FeishuClient {
  constructor() {
    this.baseURL = 'https://open.feishu.cn/open-apis';
    this.tokenCache = null;
    this.tokenExpireTime = 0;
  }

  async getConfig() {
    const config = await chrome.storage.sync.get(['appId', 'appSecret', 'baseId']);
    if (!config.appId || !config.appSecret || !config.baseId) {
      throw new Error('请先在扩展设置中配置飞书应用凭证');
    }
    return config;
  }

  async getAccessToken() {
    // 检查缓存的 token 是否有效
    if (this.tokenCache && Date.now() < this.tokenExpireTime) {
      return this.tokenCache;
    }

    const { appId, appSecret } = await this.getConfig();

    const response = await fetch(`${this.baseURL}/auth/v3/tenant_access_token/internal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        app_id: appId,
        app_secret: appSecret
      })
    });

    const data = await response.json();
    console.log('Token response:', data); // 添加日志

    if (data.code !== 0) {
      throw new Error(`获取 Token 失败: ${data.msg || '未知错误'}`);
    }

    this.tokenCache = data.tenant_access_token;
    this.tokenExpireTime = Date.now() + (data.expire - 300) * 1000;
    
    return this.tokenCache;
  }

  /**
   * 上传文件到飞书云空间
   * @param {Blob} file - 要上传的文件Blob对象
   * @param {string} fileName - 文件名
   * @param {string} fileType - 文件类型
   * @param {string} parentType - 父节点类型，如 'bitable'
   * @param {string} parentNode - 父节点ID
   * @returns {Promise<Object>} - 上传结果，包含file_token等信息
   */
  async uploadFile(file, fileName, fileType, parentType, parentNode) {
    console.log('开始上传文件:', fileName, '大小:', file.size, '类型:', fileType);
    
    const token = await this.getAccessToken();
    
    // 构建FormData
    const formData = new FormData();
    formData.append('file_name', fileName);
    formData.append('parent_type', parentType);
    formData.append('parent_node', parentNode);
    formData.append('size', file.size);
    formData.append('file', file, fileName);
    
    // 打印FormData内容
    console.log('上传参数:');
    for (let [key, value] of formData.entries()) {
      console.log(`- ${key}: ${value instanceof Blob ? `[Blob size: ${value.size}, type: ${value.type}]` : value}`);
    }
    
    // 发送请求
    let response;
    try {
      response = await fetch(`${this.baseURL}/drive/v1/medias/upload_all`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
    } catch (error) {
      console.error('上传文件网络请求失败:', error);
      const customError = new Error('上传文件网络请求失败');
      customError.details = `网络错误: ${error.message}`;
      throw customError;
    }
    
    // 检查响应状态
    console.log('上传响应状态:', response.status);
    console.log('上传响应头:', Object.fromEntries(response.headers.entries()));
    
    // 解析响应
    let result;
    try {
      result = await response.json();
    } catch (error) {
      console.error('解析上传响应失败:', error);
      const customError = new Error('解析上传响应失败');
      customError.details = `响应不是有效的JSON: ${error.message}`;
      throw customError;
    }
    
    console.log('上传响应数据:', result);
    
    // 检查响应结果
    if (result.code !== 0) {
      const error = new Error(`上传文件失败: ${result.msg || JSON.stringify(result)}`);
      error.code = result.code;
      error.details = `
        错误代码: ${result.code}
        错误消息: ${result.msg || '无'}
        完整响应: ${JSON.stringify(result, null, 2)}
      `;
      throw error;
    }
    
    if (!result.data?.file_token) {
      const error = new Error('上传成功但未获取到文件token');
      error.details = `API返回成功但缺少必要的file_token字段: ${JSON.stringify(result, null, 2)}`;
      throw error;
    }
    
    return result.data;
  }

  async savePage(pageData) {
    try {
      const token = await this.getAccessToken();
      const { baseId } = await this.getConfig();

      // 打印 token 和 baseId
      console.log('Token:', token);
      console.log('BaseId:', baseId);

      // 打印截图数据信息
      console.log('Screenshot data type:', typeof pageData.screenshot);
      console.log('Screenshot data length:', pageData.screenshot.length);
      console.log('Screenshot data preview:', pageData.screenshot.substring(0, 100) + '...');

      // 将截图转换为 Blob
      let blob;
      try {
        // 检查截图数据格式
        const base64Data = pageData.screenshot.split(',');
        if (base64Data.length !== 2) {
          const error = new Error('图片格式不正确');
          error.details = '截图数据格式不符合 Base64 数据 URL 格式';
          throw error;
        }
        
        // 获取截图的 Blob 对象
        const response = await fetch(pageData.screenshot);
        blob = await response.blob();
        console.log('Blob type:', blob.type);
        console.log('Blob size:', blob.size);
        
        if (blob.size === 0) {
          const error = new Error('截图数据为空');
          error.details = '获取到的截图 Blob 大小为 0，可能是截图获取失败';
          throw error;
        }
      } catch (fetchError) {
        const error = new Error('处理截图数据失败');
        error.details = `获取截图 Blob 时出错: ${fetchError.message}`;
        throw error;
      }

      // 使用新的上传文件函数上传截图
      const fileName = `screenshot_${Date.now()}.jpg`;
      const uploadData = await this.uploadFile(
        blob,
        fileName,
        blob.type,
        'bitable',
        baseId
      );

      // 获取表格 ID
      let tableResp;
      try {
        tableResp = await fetch(`${this.baseURL}/bitable/v1/apps/${baseId}/tables`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
      } catch (networkError) {
        const error = new Error('获取表格列表网络请求失败');
        error.details = `网络错误: ${networkError.message}`;
        throw error;
      }
      
      let tableData;
      try {
        tableData = await tableResp.json();
      } catch (jsonError) {
        const error = new Error('解析表格响应失败');
        error.details = `响应不是有效的 JSON: ${jsonError.message}`;
        throw error;
      }
      
      console.log('Table response:', tableData);
      
      if (tableData.code !== 0) {
        const error = new Error(`获取表格失败: ${tableData.msg || JSON.stringify(tableData)}`);
        error.code = tableData.code;
        error.details = `
          错误代码: ${tableData.code}
          错误消息: ${tableData.msg || '无'}
          完整响应: ${JSON.stringify(tableData, null, 2)}
        `;
        throw error;
      }
      
      if (!tableData.data?.items?.length) {
        const error = new Error('表格为空');
        error.details = `API 返回成功但没有找到任何表格: ${JSON.stringify(tableData, null, 2)}`;
        throw error;
      }

      const tableId = tableData.data.items[0].table_id;
      
      // 获取表格字段信息
      let fieldsResp;
      try {
        fieldsResp = await fetch(`${this.baseURL}/bitable/v1/apps/${baseId}/tables/${tableId}/fields`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
      } catch (networkError) {
        const error = new Error('获取表格字段信息失败');
        error.details = `网络错误: ${networkError.message}`;
        throw error;
      }
      
      let fieldsData;
      try {
        fieldsData = await fieldsResp.json();
      } catch (jsonError) {
        const error = new Error('解析表格字段响应失败');
        error.details = `响应不是有效的 JSON: ${jsonError.message}`;
        throw error;
      }
      
      console.log('Fields response:', fieldsData);
      
      if (fieldsData.code !== 0) {
        const error = new Error(`获取表格字段失败: ${fieldsData.msg || JSON.stringify(fieldsData)}`);
        error.code = fieldsData.code;
        error.details = `
          错误代码: ${fieldsData.code}
          错误消息: ${fieldsData.msg || '无'}
          完整响应: ${JSON.stringify(fieldsData, null, 2)}
        `;
        throw error;
      }
      
      // 构建字段映射
      const fieldMap = {
        url: 'URL',
        title: 'Title',
        description: 'Description',
        screenshot: 'Screenshot',
        content: 'Content'
      };
      
      // 检查字段是否存在，并更新字段映射
      if (fieldsData.data?.items) {
        console.log('[飞藏] 开始检查字段映射...');
        const availableFields = fieldsData.data.items.map(field => ({
          id: field.field_id,
          name: field.field_name,
          type: field.type
        }));
        
        console.log('[飞藏] 数据表中的可用字段:', availableFields);
        
        // 尝试匹配字段名称（不区分大小写）
        for (const field of availableFields) {
          const fieldNameLower = field.name.toLowerCase();
          console.log('[飞藏] 检查字段:', field.name);
          
          if (fieldNameLower === 'url' || fieldNameLower === 'link') {
            fieldMap.url = field.name;
            console.log('[飞藏] 匹配到 URL 字段:', field.name);
          } else if (fieldNameLower === 'title' || fieldNameLower === '标题') {
            fieldMap.title = field.name;
            console.log('[飞藏] 匹配到标题字段:', field.name);
          } else if (fieldNameLower === 'description' || fieldNameLower === '描述' || fieldNameLower === 'desc') {
            fieldMap.description = field.name;
            console.log('[飞藏] 匹配到描述字段:', field.name);
          } else if (fieldNameLower === 'screenshot' || fieldNameLower === '截图' || fieldNameLower === 'image' || fieldNameLower === '图片') {
            fieldMap.screenshot = field.name;
            console.log('[飞藏] 匹配到截图字段:', field.name);
          } else if (fieldNameLower === 'content' || fieldNameLower === '正文' || fieldNameLower === 'text') {
            fieldMap.content = field.name;
            console.log('[飞藏] 匹配到正文字段:', field.name);
          }
        }
        
        console.log('[飞藏] 最终的字段映射:', fieldMap);
      }

      // 构建保存记录的数据
      const recordData = {
        fields: {}
      };
      
      console.log('[飞藏] 开始构建记录数据...');
      
      // 添加URL字段
      if (pageData.url) {
        recordData.fields[fieldMap.url] = pageData.url;
        console.log('[飞藏] 添加 URL:', pageData.url);
      }
      
      // 添加标题字段
      if (pageData.title) {
        recordData.fields[fieldMap.title] = pageData.title;
        console.log('[飞藏] 添加标题:', pageData.title);
      }
      
      // 添加描述字段
      if (pageData.description) {
        recordData.fields[fieldMap.description] = pageData.description;
        console.log('[飞藏] 添加描述，长度:', pageData.description.length);
      }

      // 添加正文内容字段
      if (pageData.content) {
        console.log('[飞藏] 正在保存正文内容:', {
          fieldName: fieldMap.content,
          contentLength: pageData.content.length,
          contentPreview: pageData.content.substring(0, 100) + '...'
        });
        recordData.fields[fieldMap.content] = pageData.content;
      } else {
        console.warn('[飞藏] 警告：没有找到正文内容');
      }
      
      // 添加截图字段
      recordData.fields[fieldMap.screenshot] = [{
        file_token: uploadData.file_token,
        name: uploadData.file_name || fileName
      }];
      
      console.log('[飞藏] 最终的记录数据:', recordData);

      // 保存记录到多维表格
      let saveResp;
      try {
        saveResp = await fetch(`${this.baseURL}/bitable/v1/apps/${baseId}/tables/${tableId}/records`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(recordData)
        });
      } catch (networkError) {
        const error = new Error('保存记录网络请求失败');
        error.details = `网络错误: ${networkError.message}`;
        throw error;
      }

      let saveData;
      try {
        saveData = await saveResp.json();
      } catch (jsonError) {
        const error = new Error('解析保存响应失败');
        error.details = `响应不是有效的 JSON: ${jsonError.message}`;
        throw error;
      }
      
      console.log('Save response:', saveData);

      if (saveData.code !== 0) {
        const error = new Error(`保存记录失败: ${saveData.msg || JSON.stringify(saveData)}`);
        error.code = saveData.code;
        error.details = `
          错误代码: ${saveData.code}
          错误消息: ${saveData.msg || '无'}
          完整响应: ${JSON.stringify(saveData, null, 2)}
        `;
        throw error;
      }

      return saveData.data;
    } catch (error) {
      console.error('Save page error:', error);
      // 打印完整的错误堆栈
      console.error('Error stack:', error.stack);
      
      // 如果错误没有详细信息，添加一些通用的调试信息
      if (!error.details) {
        error.details = `
          错误类型: ${error.name}
          错误消息: ${error.message}
          错误堆栈: ${error.stack}
          
          请检查:
          1. 飞书应用凭证是否正确
          2. 网络连接是否正常
          3. 多维表格 ID 是否有效
          4. 截图数据是否完整
          5. 多维表格字段名称是否正确
        `;
      }
      
      throw error;
    }
  }
}

export const feishuClient = new FeishuClient(); 