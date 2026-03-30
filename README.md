# Visual Inspiration Capturer 2.0

<p align="center">
  <img src="assets/icon128.png" width="128" alt="Logo">
</p>

## 📖 简介 (Description)

**Visual Inspiration Capturer 2.0** 是一款专为设计师和前端开发者打造的 Chrome 浏览器扩展工具。它可以帮助你一键精准捕获网页上的设计灵感，深度提取任何元素的 CSS 样式、排版字体、色彩规范以及全站的图片素材。

**Visual Inspiration Capturer 2.0** is a Chrome browser extension tailored for designers and front-end developers. It helps you accurately capture design inspiration from any webpage with a single click, deeply extracting CSS styles, typography, color palettes, and all image assets across the site.

## ✨ 核心功能 (Key Features)

- 🔍 **深度审查模式 (Deep Inspector Mode)**: 像使用原生开发者工具一样，只需将鼠标悬停在网页元素上，即可高亮并精准获取它的完整盒模型 (Box Model)、尺寸、圆角等 CSS 属性。
- 📝 **排版提取 (Typography Extraction)**: 一键提取网页中使用的所有字体家族、字号、行高和字重，并支持快速复制完整的 CSS 代码。
- 🎨 **智能色板 (Smart Color Palette)**: 自动扫描全站元素，提取出现频率最高的颜色并生成可视化色板，支持 HEX/RGB 格式切换，并附带 WCAG 颜色对比度检测，一键导出 JSON 格式色板。
- 📦 **素材抓取 (Asset Extractor)**: 自动捕获网页中的所有图片、视频封面、背景图以及内联 SVG 图标，支持按格式过滤并提供一键打包下载 (ZIP) 功能。
- 🌗 **暗黑模式支持 (Dark Mode Support)**: 界面自适应 macOS 和 Windows 的系统级深色/浅色模式，提供原生的沉浸式体验。

## 🚀 安装指南 (Installation)

1. 克隆或下载此代码库到本地。 (Clone or download this repository to your local machine.)
2. 打开 Chrome 浏览器，访问 `chrome://extensions/`。 (Open Chrome and navigate to `chrome://extensions/`.)
3. 在右上角开启 **开发者模式 (Developer mode)**。 (Enable **Developer mode** in the top right corner.)
4. 点击 **加载已解压的扩展程序 (Load unpacked)**。 (Click **Load unpacked**.)
5. 选择你刚刚下载并解压的 `Visual Inspiration Capturer` 文件夹。 (Select the unzipped `Visual Inspiration Capturer` folder.)
6. 安装成功！点击浏览器工具栏上的插件图标即可开始使用。 (Installation successful! Click the extension icon in the browser toolbar to start using it.)

## 🛠️ 技术栈 (Tech Stack)

- 原生 JavaScript (Vanilla JS)
- Chrome Extension Manifest V3
- HTML5 & CSS3
- JSZip (用于打包下载素材)
- html2canvas (用于网页截图处理)

## 📄 许可证 (License)

MIT License