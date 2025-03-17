# 飞藏 (FeiCang) - 一键收藏到飞书多维表格

[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/akphiomifebippogfocekdjbffalcanb?label=Chrome%20Web%20Store&logo=google-chrome&style=flat-square)](https://chromewebstore.google.com/detail/%E9%A3%9E%E8%97%8F/akphiomifebippogfocekdjbffalcanb)

飞藏，专为知识工作者设计的剪藏工具。一键收藏到飞书多维表格，打造自己专属阅读工作流。

> **注意**: Chrome 商店版本 (v1.0.1) 暂不支持收藏全文功能，建议使用下方的 ZIP 包安装方式获取完整功能。

## 👨‍💻 作者

Roy  [https://cursor101.com](https://cursor101.com)

加入用户群
- 分享你的工作流
- 提出你的需求
<img src="https://github.com/user-attachments/assets/edd386c3-7a98-41c5-8d71-e0766d16449e" alt="jpg name" width="200px"/>

## 🌟 核心功能

- **智能提取** - 自动提取网页标题、描述和正文内容
- **一键保存** - 快速保存网页信息到飞书多维表格
- **页面预览** - 自动截取当前页面作为预览图

## 💡 使用场景

- **文章收藏** - 保存感兴趣的文章和博客到飞书
- **资料整理** - 将网页资料有序地存储在多维表格中
- **稍后阅读** - 快速保存当前页面，方便后续查阅
- **团队共享** - 收藏的内容可在飞书中与团队共享

## 📦 安装配置

### 1. 准备飞书多维表格

1. **复制模板**
   - 打开[飞藏收藏模板](https://hix35kkq1h.feishu.cn/base/Z4AibpzeXaoUyWsvpf8clqZanCf?table=tblTix3I649vHi6q&view=vewSl681bS)
   - 点击右上角的「复制模板」
   - 选择保存到自己的空间

2. **创建飞书应用**
   - 在复制好的模板中，打开「帮助」>「设置指南」
   - 按照指南创建飞书应用
   - 获取应用的 App ID 和 App Secret
   - 记录多维表格的 Base ID

### 2. 安装扩展

1. **下载安装**
   - 方式一：[Chrome 商店安装](https://chromewebstore.google.com/detail/%E9%A3%9E%E8%97%8F/akphiomifebippogfocekdjbffalcanb)（v1.0.1 版本，不含收藏全文功能,最新版正在审核）
   - 方式二：直接[下载 ZIP 包](https://github.com/biubiubiu35/feicang-extension/archive/refs/heads/main.zip)并解压（推荐，包含全部功能）
   - 方式三：使用 Git 克隆项目
     ```bash
     git clone https://github.com/biubiubiu35/feicang-extension.git
     ```
   - 打开 Chrome，进入扩展程序页面 (chrome://extensions/)
   - 开启"开发者模式"
     <img src="https://github.com/user-attachments/assets/25724b2b-5d34-4b5d-93ca-3f0d5f0924ce" width="400px">

   - 点击"加载已解压的扩展程序"，选择项目文件夹

2. **配置扩展**
   - 点击扩展图标，进入设置页面
   - 填写之前获取的 App ID 和 App Secret
   - 填写多维表格的 Base ID
   - 保存配置

## 🚀 使用方法

1. **保存网页**
   - 在想要保存的网页上点击扩展图标
   - 预览自动提取的网页信息
   - 可选择编辑标题
   - 点击保存按钮或按回车键确认保存

2. **自动去重**
   - 浏览器有收藏列表，插件会根据列表自动去重，防止重复收藏
   - 完整记录可在飞书多维表格中查看

## 🔧 技术特点

- 使用 Readability 算法智能提取页面正文
- 支持自动截取页面预览图
- 采用 Chrome Storage API 进行本地数据管理
- 集成飞书开放接口进行数据存储

## 📝 许可证

MIT License

## 🤝 参与贡献

欢迎提交 Issue 和 Pull Request 来帮助改进这个项目。如果你有任何建议或发现了 bug，请随时告诉我们！

