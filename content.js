/**
 * content.js
 * 注入到网页中，提供悬浮画板和全站分析功能
 */

// 防止重复注入导致变量冲突
if (typeof window.vicInjected === 'undefined') {
  window.vicInjected = true;

  let panelContainer = null;
  let isPanelOpen = false;
  let isScanning = false;

// 全局存储分析结果
let scannedData = {
  fonts: [],
  colors: [],
  assets: []
};

// ==========================================
// Inspector Mode (审查模式) - 常驻后台并精准捕获
// ==========================================
let highlightBox = null;
let highlightSizeLabel = null;
let currentHoveredElement = null;
let isContextMenuEnabled = false;

function enableInspector() {
  if (highlightBox) return;

  highlightBox = document.createElement('div');
  highlightBox.id = 'vic-inspector-highlight';
  highlightBox.style.position = 'fixed';
  highlightBox.style.pointerEvents = 'none'; // 关键：确保高亮框不阻挡鼠标事件
  highlightBox.style.zIndex = '2147483646';
  highlightBox.style.border = '2px solid #5e5ce6';
  highlightBox.style.backgroundColor = 'rgba(94, 92, 230, 0.1)';
  // 移除 transition，防止移动时出现延迟拖影，提高跟手感
  highlightBox.style.transition = 'none';
  highlightBox.style.display = 'none';
  // 隔离层级，避免被宿主页面的 z-index 影响
  highlightBox.style.isolation = 'isolate';

  highlightSizeLabel = document.createElement('div');
  highlightSizeLabel.id = 'vic-inspector-size-label';
  highlightBox.appendChild(highlightSizeLabel);
  
  // 插入到 document.documentElement (html) 而不是 body，避免 body 的 transform/overflow 影响 fixed 定位
  document.documentElement.appendChild(highlightBox);

  // 捕获阶段绑定事件，确保比网页上其他组件的事件更早触发
  // 使用 mouseover 代替 mousemove，利用浏览器原生事件冒泡/捕获机制，极大地提升精准度
  document.addEventListener('mouseover', onInspectorMouseOver, true);
  document.addEventListener('mouseout', onInspectorMouseOut, true);
  document.addEventListener('mousedown', onInspectorClick, true);
  document.addEventListener('click', onInspectorPreventClick, true);
  document.addEventListener('contextmenu', onInspectorContextMenu, true);
}

function disableInspector() {
  if (highlightBox) {
    highlightBox.remove();
    highlightBox = null;
    highlightSizeLabel = null;
  }
  document.removeEventListener('mouseover', onInspectorMouseOver, true);
  document.removeEventListener('mouseout', onInspectorMouseOut, true);
  document.removeEventListener('mousedown', onInspectorClick, true);
  document.removeEventListener('click', onInspectorPreventClick, true);
  document.removeEventListener('contextmenu', onInspectorContextMenu, true);
  currentHoveredElement = null;
}

function onInspectorContextMenu(e) {
  if (isPanelOpen) {
    if (!isContextMenuEnabled && !e.target.closest('#vic-floating-panel-container')) {
      e.preventDefault(); // 拦截右键
    }
  }
}

function onInspectorMouseOver(e) {
  if (!isPanelOpen) return;
  
  const target = e.target;

  // 忽略自身面板和高亮框
  if (target.id === 'vic-inspector-highlight' || target.closest('#vic-floating-panel-container')) {
    return;
  }
  
  // 防止重复处理同一个元素
  if (currentHoveredElement === target) return;
  currentHoveredElement = target;

  try {
    const rect = target.getBoundingClientRect();
    
    // 如果元素不在可视区域，不显示
    if (rect.width === 0 || rect.height === 0) {
      highlightBox.style.display = 'none';
      return;
    }

    highlightBox.style.display = 'block';
    // 修改为 fixed 定位，直接使用 clientRect，因为 highlightBox 也是 fixed
    // 这里修复之前的坐标问题，由于 fixed 始终相对于视口，所以不要加上 scrollTop
    highlightBox.style.top = rect.top + 'px';
    highlightBox.style.left = rect.left + 'px';
    highlightBox.style.width = rect.width + 'px';
    highlightBox.style.height = rect.height + 'px';

    // 实时显示宽高标签
    if (highlightSizeLabel) {
      highlightSizeLabel.textContent = `${Math.round(rect.width)} × ${Math.round(rect.height)}`;
      // 如果太靠下，把标签放到上面
      if (rect.bottom > window.innerHeight - 30) {
        highlightSizeLabel.style.bottom = 'auto';
        highlightSizeLabel.style.top = '-24px';
      } else {
        highlightSizeLabel.style.bottom = '-24px';
        highlightSizeLabel.style.top = 'auto';
      }
    }
  } catch (err) {
    // 忽略异常，防止页面崩溃
  }
}

function onInspectorMouseOut(e) {
  if (!isPanelOpen) return;
  const target = e.target;
  if (target === currentHoveredElement) {
    // 鼠标移出当前元素时，清空状态并隐藏高亮框
    currentHoveredElement = null;
    highlightBox.style.display = 'none';
  }
}

function onInspectorClick(e) {
  if (!isPanelOpen || !currentHoveredElement) return;
  
  // 如果点击的是插件面板，不拦截
  if (e.target.closest('#vic-floating-panel-container')) return;

  // 拦截所有网页默认点击行为
  e.preventDefault();
  e.stopPropagation();

  try {
    // 渲染数据
    renderInspectorDetails(currentHoveredElement);

    // 自动切换到 Inspector Tab
    const inspectorTabBtn = document.querySelector('.vic-tab-btn[data-target="vic-tab-inspector"]');
    if (inspectorTabBtn) {
      inspectorTabBtn.style.display = 'inline-block';
      
      // 手动切换，确保绝对生效
      document.querySelectorAll('.vic-tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.vic-tab-pane').forEach(p => p.classList.remove('active'));
      inspectorTabBtn.classList.add('active');
      const inspPane = document.getElementById('vic-tab-inspector');
      if (inspPane) inspPane.classList.add('active');
      const title = document.querySelector('.vic-nav-label');
      if (title) title.textContent = 'Inspector';
    }
    
    // 取消高亮框显示，避免阻挡视线，直到下一次 mouseover
    if (highlightBox) {
      highlightBox.style.display = 'none';
    }
  } catch (err) {
    console.error("Inspector error:", err);
  }
}

function onInspectorPreventClick(e) {
  if (!isPanelOpen) return;
  if (e.target.closest('#vic-floating-panel-container')) return;
  e.preventDefault();
  e.stopPropagation();
}

// 计算对比度 (基于 WCAG 2.0)
function getLuminance(r, g, b) {
  let [rs, gs, bs] = [r/255, g/255, b/255].map(c => 
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  );
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function getContrastRatio(rgb1, rgb2) {
  if (!rgb1 || !rgb2) return null;
  const l1 = getLuminance(...rgb1);
  const l2 = getLuminance(...rgb2);
  const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  return Math.round(ratio * 100) / 100;
}

function renderInspectorDetails(el) {
  if (!el) return;
  const emptyView = document.getElementById('vic-inspector-empty');
  const detailsView = document.getElementById('vic-inspector-details');
  if (!emptyView || !detailsView) return;
  
  emptyView.style.display = 'none';
  detailsView.style.display = 'block';

  let style;
  try {
    // 处理文本节点，获取其父元素的样式
    const targetEl = el.nodeType === Node.TEXT_NODE ? el.parentElement : el;
    if (!targetEl) return;
    style = window.getComputedStyle(targetEl);
  } catch (e) {
    console.error("Could not get computed style", e);
    return;
  }
  
  if (!style) return;
  
  let rect;
  try {
    const targetEl = el.nodeType === Node.TEXT_NODE ? el.parentElement : el;
    rect = targetEl.getBoundingClientRect();
  } catch (e) {
    rect = { width: 0, height: 0 };
  }

  // 1. 头部标签
  let tagName = el.tagName ? el.tagName.toLowerCase() : 'unknown';
  tagName = tagName.charAt(0).toUpperCase() + tagName.slice(1);
  const tagEl = document.getElementById('vic-insp-tag');
  if (tagEl) tagEl.textContent = tagName;
  
  let selector = el.tagName ? el.tagName.toLowerCase() : '';
  if (el.id) {
    selector += `#${el.id}`;
  }
  
  // 安全地处理 class 属性
  let classStr = '';
  if (typeof el.className === 'string') {
    classStr = el.className;
  } else if (el.className && typeof el.className.baseVal === 'string') {
    // 处理 SVG 元素的 class
    classStr = el.className.baseVal;
  }
  
  if (classStr) {
    const classList = classStr.trim().split(/\s+/).filter(c => c);
    if (classList.length > 0) {
      selector += `.${classList.join('.')}`;
    }
  }
  
  const selectorEl = document.getElementById('vic-insp-selector');
  if (selectorEl) selectorEl.textContent = selector;

  // 2. 盒模型
  const bmMarginTop = document.getElementById('bm-margin-top');
  if (bmMarginTop) bmMarginTop.textContent = parseInt(style.marginTop) || '-';
  const bmMarginBottom = document.getElementById('bm-margin-bottom');
  if (bmMarginBottom) bmMarginBottom.textContent = parseInt(style.marginBottom) || '-';
  const bmMarginLeft = document.getElementById('bm-margin-left');
  if (bmMarginLeft) bmMarginLeft.textContent = parseInt(style.marginLeft) || '-';
  const bmMarginRight = document.getElementById('bm-margin-right');
  if (bmMarginRight) bmMarginRight.textContent = parseInt(style.marginRight) || '-';

  const bmPaddingTop = document.getElementById('bm-padding-top');
  if (bmPaddingTop) bmPaddingTop.textContent = parseInt(style.paddingTop) || '-';
  const bmPaddingBottom = document.getElementById('bm-padding-bottom');
  if (bmPaddingBottom) bmPaddingBottom.textContent = parseInt(style.paddingBottom) || '-';
  const bmPaddingLeft = document.getElementById('bm-padding-left');
  if (bmPaddingLeft) bmPaddingLeft.textContent = parseInt(style.paddingLeft) || '-';
  const bmPaddingRight = document.getElementById('bm-padding-right');
  if (bmPaddingRight) bmPaddingRight.textContent = parseInt(style.paddingRight) || '-';

  const bmContentSize = document.getElementById('bm-content-size');
  if (bmContentSize) bmContentSize.textContent = `${Math.round(rect.width)} X ${Math.round(rect.height)}`;

  // 3. Text Properties
  const fontFamilyStr = style.fontFamily || '';
  const fontFamily = fontFamilyStr.replace(/['"]/g, '');
  const fontEl = document.getElementById('vic-insp-font-family');
  if (fontEl) {
    fontEl.textContent = fontFamily || '-';
    fontEl.title = fontFamily; // 超长可悬浮查看
  }
  
  const sizeEl = document.getElementById('vic-insp-font-size');
  if (sizeEl) sizeEl.textContent = style.fontSize || '-';
  
  const lhEl = document.getElementById('vic-insp-line-height');
  if (lhEl) lhEl.textContent = style.lineHeight || '-';
  
  const fwEl = document.getElementById('vic-insp-font-weight');
  if (fwEl) fwEl.textContent = style.fontWeight ? `${mapFontWeight(style.fontWeight)} (${style.fontWeight})` : '-';
  
  const lsEl = document.getElementById('vic-insp-letter-spacing');
  if (lsEl) lsEl.textContent = style.letterSpacing !== 'normal' ? style.letterSpacing : '0px';

  const textRgb = parseRGB(style.color);
  const textHex = rgbToHex(textRgb) || style.color || '#000000';
  const colorDot = document.getElementById('vic-insp-color-dot');
  if (colorDot) colorDot.style.backgroundColor = textHex;
  const colorHexEl = document.getElementById('vic-insp-color-hex');
  if (colorHexEl) colorHexEl.textContent = textHex;
  
  // 绑定复制
  const copyBtns = detailsView.querySelectorAll('.vic-copy-btn');
  if (copyBtns.length > 0) {
    copyBtns[0].onclick = () => copyToClipboard(textHex);
  }

  // 4. Selection Colors & Contrast
  let bgRgb = parseRGB(style.backgroundColor);
  
  // 如果背景透明，尝试寻找父级背景色
  let parentEl = el.nodeType === Node.TEXT_NODE ? el.parentElement : el.parentElement;
  while (!bgRgb && parentEl) {
    try {
      const parentStyle = window.getComputedStyle(parentEl);
      if (parentStyle) {
        const pBg = parseRGB(parentStyle.backgroundColor);
        if (pBg) {
          bgRgb = pBg;
          break;
        }
      }
    } catch (e) {}
    parentEl = parentEl.parentElement;
  }
  
  // 如果还是没有，默认白色
  if (!bgRgb) bgRgb = [255, 255, 255];
  
  const bgHex = rgbToHex(bgRgb);

  const selTextHexEl = document.getElementById('vic-sel-text-hex');
  if (selTextHexEl) selTextHexEl.textContent = textHex;
  
  const selTextCardEl = document.getElementById('vic-sel-text-card');
  if (selTextCardEl) {
    selTextCardEl.style.backgroundColor = textHex;
    selTextCardEl.style.color = getLuminance(...textRgb) > 0.5 ? '#000' : '#fff';
  }
  
  if (copyBtns.length > 1) {
    copyBtns[1].onclick = () => copyToClipboard(textHex);
  }

  const selBgHexEl = document.getElementById('vic-sel-bg-hex');
  if (selBgHexEl) selBgHexEl.textContent = bgHex;
  
  const selBgCardEl = document.getElementById('vic-sel-bg-card');
  if (selBgCardEl) {
    selBgCardEl.style.backgroundColor = bgHex;
    selBgCardEl.style.color = getLuminance(...bgRgb) > 0.5 ? '#000' : '#fff';
  }
  
  if (copyBtns.length > 2) {
    copyBtns[2].onclick = () => copyToClipboard(bgHex);
  }

  // 计算对比度
  const ratio = getContrastRatio(textRgb, bgRgb);
  const ratioEl = document.getElementById('vic-contrast-ratio');
  const badgeEl = document.getElementById('vic-contrast-badge');
  
  if (ratio) {
    ratioEl.textContent = `${ratio} : 1`;
    if (ratio >= 7) {
      badgeEl.textContent = '✅ Excellent';
      badgeEl.style.color = '#34c759';
      badgeEl.style.backgroundColor = '#e8f5e9';
    } else if (ratio >= 4.5) {
      badgeEl.textContent = '⚠️ Good';
      badgeEl.style.color = '#ff9500';
      badgeEl.style.backgroundColor = '#fff3e0';
    } else {
      badgeEl.textContent = '❌ Poor';
      badgeEl.style.color = '#ff3b30';
      badgeEl.style.backgroundColor = '#ffebee';
    }
  } else {
    ratioEl.textContent = `- : 1`;
    badgeEl.textContent = 'Unknown';
    badgeEl.style.color = '#86868b';
    badgeEl.style.backgroundColor = '#f5f5f7';
  }

  // 5. Element Properties
  const widthEl = document.getElementById('vic-insp-width');
  if (widthEl) widthEl.textContent = `${Math.round(rect.width)}px`;
  
  const heightEl = document.getElementById('vic-insp-height');
  if (heightEl) heightEl.textContent = `${Math.round(rect.height)}px`;
  
  const radiusEl = document.getElementById('vic-insp-radius');
  if (radiusEl) radiusEl.textContent = style.borderRadius !== '0px' ? style.borderRadius : '0px';
}

// ==========================================
// 消息监听
// ==========================================
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'togglePanel') {
    if (isPanelOpen) {
      closePanel();
    } else {
      openPanel();
    }
    sendResponse({ status: 'ok' }); // 必须调用 sendResponse，否则 background.js 会认为发送失败并重复注入
  }
  return true; // 保持消息通道打开
});

// ==========================================
// UI 面板生命周期
// ==========================================
async function openPanel() {
  if (panelContainer) {
    panelContainer.style.display = 'flex';
    setTimeout(() => panelContainer.style.opacity = '1', 10);
  } else {
    try {
      await injectPanelHTML();
      setupPanelEvents();
      makePanelDraggable();
    } catch (e) {
      console.error("Failed to init panel:", e);
      return;
    }
  }
  isPanelOpen = true;

  // 默认激活审查模式
  enableInspector();
  // 重置审查面板为空状态
  const emptyView = document.getElementById('vic-inspector-empty');
  const detailsView = document.getElementById('vic-inspector-details');
  if (emptyView && detailsView) {
    emptyView.style.display = 'block';
    detailsView.style.display = 'none';
  }
  
  // 确保切换回全部 Tab
  const inspectorTabBtn = document.querySelector('.vic-tab-btn[data-target="vic-tab-inspector"]');
  if (inspectorTabBtn) {
    inspectorTabBtn.style.display = 'none';
  }

  // 每次打开如果没扫描过，自动扫描
  if (!isScanning && scannedData.colors.length === 0) {
    scanFullPage();
  } else {
    document.querySelectorAll('.vic-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.vic-tab-pane').forEach(p => p.classList.remove('active'));
    const allBtn = document.querySelector('.vic-tab-btn[data-target="vic-tab-all"]');
    if (allBtn) allBtn.classList.add('active');
    const allPane = document.getElementById('vic-tab-all');
    if (allPane) allPane.classList.add('active');
    const title = document.querySelector('.vic-nav-label');
    if (title) title.textContent = 'Visual Inspiration';
    renderAllData(); // 如果已经有数据，直接渲染
  }
}

function closePanel() {
  if (panelContainer) {
    panelContainer.style.opacity = '0';
    setTimeout(() => {
      panelContainer.style.display = 'none';
    }, 200);
  }
  isPanelOpen = false;
  disableInspector();
}

async function injectPanelHTML() {
  const existing = document.getElementById('vic-floating-panel-container');
  if (existing) {
    existing.remove(); // 移除旧的面板，防止热更新时重复注入
  }
  
  const url = chrome.runtime.getURL('panel.html');
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Network response was not ok');
    const html = await response.text();
    
    // 解析 HTML 并提取我们需要的容器
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const panel = doc.getElementById('vic-floating-panel-container');
    
    if (panel) {
      document.body.appendChild(panel);
      panelContainer = panel;
    } else {
      throw new Error('Panel container not found in HTML');
    }
  } catch (err) {
    console.error('Failed to load panel.html', err);
    throw err;
  }
}

// ==========================================
// 全局状态管理与事件绑定
// ==========================================
function setupPanelEvents() {
  // 关闭按钮
  const closeBtn = document.getElementById('vic-panel-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', closePanel);
  }

  // ESC 键关闭
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isPanelOpen) closePanel();
  });

  const tabTitle = document.querySelector('.vic-nav-label'); // 修复选择器
  const inspectTabBtn = document.querySelector('.vic-tab-btn[data-target="vic-tab-inspector"]');

  // Tab 切换逻辑
  const tabBtns = document.querySelectorAll('.vic-tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const targetBtn = e.target.closest('.vic-tab-btn');
      if (!targetBtn) return;
      const targetId = targetBtn.dataset.target;
      
      tabBtns.forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.vic-tab-pane').forEach(p => {
        p.classList.remove('active');
      });
      
      targetBtn.classList.add('active');
      const targetPane = document.getElementById(targetId);
      if (targetPane) targetPane.classList.add('active');
      
      // 更新顶部标题
      if (tabTitle) {
        if (targetId === 'vic-tab-inspector') {
          tabTitle.textContent = 'Inspector';
        } else {
          tabTitle.textContent = 'Visual Inspiration';
        }
      }
    });
  });

  // Inspector 增强交互
  const contextToggle = document.getElementById('vic-context-menu-toggle');
  if (contextToggle) {
    contextToggle.addEventListener('change', (e) => {
      isContextMenuEnabled = e.target.checked;
    });
  }

  const showCodeBtn = document.getElementById('vic-show-code-btn');
  if (showCodeBtn) {
    showCodeBtn.addEventListener('click', () => {
      if (!currentHoveredElement) return;
      try {
        const style = window.getComputedStyle(currentHoveredElement);
        if (!style) return;
        
        const selectorEl = document.getElementById('vic-insp-selector');
        const selector = selectorEl ? selectorEl.textContent : 'element';
        let cssText = `${selector} {\n`;
        
        const props = ['width', 'height', 'margin', 'padding', 'font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing', 'color', 'background-color', 'border-radius'];
        props.forEach(p => {
          const val = style.getPropertyValue(p);
          if (val && val !== '0px' && val !== 'none' && val !== 'normal' && val !== 'rgba(0, 0, 0, 0)') {
            cssText += `  ${p}: ${val};\n`;
          }
        });
        cssText += `}`;
        
        copyToClipboard(cssText);
        showToast('✅ CSS 代码已复制');
      } catch (e) {
        console.error("Failed to copy code", e);
      }
    });
  }

  // 颜色视图切换
  const gridBtn = document.getElementById('vic-view-grid');
  const listBtn = document.getElementById('vic-view-list');
  const colorsContainer = document.getElementById('vic-colors-container');
  
  if (gridBtn && listBtn && colorsContainer) {
    gridBtn.addEventListener('click', () => {
      gridBtn.classList.add('active');
      listBtn.classList.remove('active');
      colorsContainer.className = 'vic-color-grid';
      renderColors(); // 重新渲染为宫格
    });
    
    listBtn.addEventListener('click', () => {
      listBtn.classList.add('active');
      gridBtn.classList.remove('active');
      colorsContainer.className = 'vic-color-list';
      renderColors(); // 重新渲染为列表
    });
  }

  // 颜色格式切换
  const colorFormatEl = document.getElementById('vic-color-format');
  if (colorFormatEl) {
    colorFormatEl.addEventListener('change', () => {
      renderColors();
    });
  }

  // 导出颜色
  const exportColorsBtn = document.getElementById('vic-export-colors-btn');
  if (exportColorsBtn) {
    exportColorsBtn.addEventListener('click', () => {
      if (scannedData.colors.length === 0) return showToast('没有可导出的颜色');
      const jsonStr = JSON.stringify({ colors: scannedData.colors }, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `palette_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('✅ 色板已导出');
    });
  }

  // 素材背景切换
  const bgToggleBtn = document.getElementById('vic-bg-toggle-btn');
  const assetsContainer = document.getElementById('vic-assets-container');
  if (bgToggleBtn && assetsContainer) {
    bgToggleBtn.addEventListener('click', () => {
      assetsContainer.classList.toggle('dark-bg');
      bgToggleBtn.classList.toggle('active');
    });
  }

  // 素材过滤
  const assetsFilterEl = document.getElementById('vic-assets-filter');
  if (assetsFilterEl) {
    assetsFilterEl.addEventListener('change', () => {
      renderAssets();
    });
  }

  // 导出素材 ZIP
  const exportAssetsBtn = document.getElementById('vic-export-assets-btn');
  if (exportAssetsBtn) {
    exportAssetsBtn.addEventListener('click', exportAssetsAsZip);
  }
}

// ==========================================
// 拖拽逻辑
// ==========================================
function makePanelDraggable() {
  const handle = document.querySelector('.vic-drag-handle');
  let isDragging = false;
  let currentX;
  let currentY;
  let initialX;
  let initialY;
  let xOffset = 0;
  let yOffset = 0;

  handle.addEventListener('mousedown', dragStart);
  document.addEventListener('mousemove', drag);
  document.addEventListener('mouseup', dragEnd);

  function dragStart(e) {
    if (!panelContainer) return;
    const rect = panelContainer.getBoundingClientRect();
    
    if (panelContainer.style.right) {
      panelContainer.style.left = rect.left + 'px';
      panelContainer.style.top = rect.top + 'px';
      panelContainer.style.right = 'auto';
      xOffset = 0;
      yOffset = 0;
    }

    initialX = e.clientX - xOffset;
    initialY = e.clientY - yOffset;
    
    isDragging = true;
    panelContainer.style.transition = 'none';
    document.body.style.pointerEvents = 'none';
    panelContainer.style.pointerEvents = 'auto';
  }

  function drag(e) {
    if (isDragging) {
      e.preventDefault();
      currentX = e.clientX - initialX;
      currentY = e.clientY - initialY;
      xOffset = currentX;
      yOffset = currentY;
      setTranslate(currentX, currentY, panelContainer);
    }
  }

  function setTranslate(xPos, yPos, el) {
    el.style.transform = `translate3d(${xPos}px, ${yPos}px, 0)`;
  }

  function dragEnd(e) {
    if (isDragging) {
      initialX = currentX;
      initialY = currentY;
      isDragging = false;
      panelContainer.style.transition = 'opacity 0.2s ease';
      document.body.style.pointerEvents = 'auto';
    }
  }
}

// ==========================================
// 全站扫描核心逻辑
// ==========================================
async function scanFullPage() {
  isScanning = true;
  document.getElementById('vic-loading').style.display = 'flex';
  document.getElementById('vic-tab-all').classList.remove('active'); // 隐藏内容直到扫描完成

  // 使用 setTimeout 让 UI 有机会渲染 Loading 状态
  setTimeout(() => {
    const elements = document.querySelectorAll('body *');
    
    const colorMap = new Map();
    const fontMap = new Map();
    const assetsSet = new Set(); // 存储图片 URL，去重

    function addColor(hex, weight) {
      if (hex && isValidColor(hex)) {
        // 统一转大写
        hex = hex.toUpperCase();
        colorMap.set(hex, (colorMap.get(hex) || 0) + weight);
      }
    }

    elements.forEach(el => {
      try {
        // 排除面板自身
        if (el.id === 'vic-floating-panel-container' || el.closest('#vic-floating-panel-container')) return;
        
        const style = window.getComputedStyle(el);
        if (!style) return;
        
        const rect = el.getBoundingClientRect();
        const area = rect.width * rect.height;
        
        // --- 1. 提取颜色 ---
        if (area > 0) {
          // 背景色
          addColor(rgbToHex(parseRGB(style.backgroundColor)), area);
          
          // 边框色
          if (style.borderWidth !== '0px' && style.borderStyle !== 'none') {
            addColor(rgbToHex(parseRGB(style.borderColor)), area * 0.2);
          }
          
          // SVG 填充与描边
          const tagName = el.tagName ? el.tagName.toLowerCase() : '';
          if (tagName === 'svg' || tagName === 'path' || tagName === 'rect') {
            addColor(rgbToHex(parseRGB(style.fill)), area);
            addColor(rgbToHex(parseRGB(style.stroke)), area * 0.2);
          }
        }

        let hasText = Array.from(el.childNodes).some(n => n.nodeType === Node.TEXT_NODE && n.nodeValue.trim().length > 0);
        if (hasText) {
          // 文本颜色
          const textHex = rgbToHex(parseRGB(style.color));
          addColor(textHex, area * 0.8);

          // --- 2. 提取字体 ---
          const fontFamily = style.fontFamily.split(',')[0].replace(/['"]/g, '').trim();
          const fontSize = style.fontSize;
          const fontWeight = mapFontWeight(style.fontWeight);
          const fontKey = `${fontFamily}|${fontSize}|${fontWeight}`;
          
          if (!fontMap.has(fontKey)) {
            fontMap.set(fontKey, {
              family: fontFamily,
              size: fontSize,
              weight: fontWeight,
              color: textHex || '#000000',
              count: 1
            });
          } else {
            fontMap.get(fontKey).count++;
          }
        }

        // --- 3. 提取素材 (Assets) ---
        const tagName = el.tagName ? el.tagName.toLowerCase() : '';
        
        // <img> 标签
        if (tagName === 'img' && el.src) {
          assetsSet.add(el.src);
        }
        
        // <video> 封面
        if (tagName === 'video' && el.poster) {
          assetsSet.add(el.poster);
        }
        
        // <picture> <source> 标签
        if (tagName === 'source' && el.srcset) {
          const srcsets = el.srcset.split(',');
          srcsets.forEach(src => {
            const url = src.trim().split(' ')[0];
            if (url) assetsSet.add(url);
          });
        }

        // <svg> 标签 (尝试获取其 outerHTML 作为 base64 data URI)
        if (tagName === 'svg') {
           try {
             // 克隆节点以避免修改原 DOM
             const clone = el.cloneNode(true);
             // 确保有 xmlns，否则作为图片打开会失效
             if (!clone.getAttribute('xmlns')) {
               clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
             }
             const svgData = new XMLSerializer().serializeToString(clone);
             const base64 = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
             assetsSet.add(base64);
           } catch(e) {}
        }
        
        // CSS Background Image (支持多个背景)
        const bgImage = style.backgroundImage;
        if (bgImage && bgImage !== 'none') {
          const urlMatches = bgImage.matchAll(/url\(['"]?(.*?)['"]?\)/g);
          for (const match of urlMatches) {
            if (match[1] && !match[1].startsWith('data:image/svg+xml')) { // 忽略太复杂的行内 svg
              assetsSet.add(match[1]);
            }
          }
        }
      } catch (err) {
        // 忽略单个元素解析错误，防止整个页面扫描崩溃
      }
    });

    // --- 整理数据 ---
    
    // 颜色：按权重排序，排除透明或无效，最多取前 60 个
    scannedData.colors = Array.from(colorMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(entry => entry[0])
      .filter(hex => hex !== '#00000000') // 排除纯透明
      .slice(0, 60);

    // 字体：按使用次数排序
    scannedData.fonts = Array.from(fontMap.values())
      .sort((a, b) => b.count - a.count);

    // 素材：转换 Set 为 Array，并过滤无效链接
    scannedData.assets = Array.from(assetsSet).filter(url => url && !url.startsWith('chrome-extension://'));

    // --- 渲染 ---
    isScanning = false;
    document.getElementById('vic-loading').style.display = 'none';
    
    document.querySelectorAll('.vic-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.vic-tab-pane').forEach(p => p.classList.remove('active'));
    const allBtn = document.querySelector('.vic-tab-btn[data-target="vic-tab-all"]');
    if (allBtn) allBtn.classList.add('active');
    const allPane = document.getElementById('vic-tab-all');
    if (allPane) allPane.classList.add('active');
    const title = document.querySelector('.vic-nav-label');
    if (title) title.textContent = 'Visual Inspiration';
    
    updateCounts();
    renderAllData();

  }, 100); // 稍微延迟以展示 Loading
}

// ==========================================
// 渲染逻辑
// ==========================================
function updateCounts() {
  document.getElementById('count-fonts').textContent = scannedData.fonts.length;
  document.getElementById('count-colors').textContent = scannedData.colors.length;
  document.getElementById('count-assets').textContent = scannedData.assets.length;
  
  document.getElementById('title-count-fonts').textContent = scannedData.fonts.length;
  document.getElementById('title-count-colors').textContent = scannedData.colors.length;
  document.getElementById('title-count-assets').textContent = scannedData.assets.length;
}

function renderAllData() {
  renderFonts();
  renderColors();
  renderAssets();
}

function renderFonts() {
  const allFontsContainer = document.getElementById('vic-all-fonts-container');
  const fullFontsContainer = document.getElementById('vic-fonts-container');
  
  allFontsContainer.innerHTML = '';
  fullFontsContainer.innerHTML = '';

  if (scannedData.fonts.length === 0) {
    const emptyMsg = '<div style="color:#86868b;font-size:12px;">未检测到明确的字体信息</div>';
    allFontsContainer.innerHTML = emptyMsg;
    fullFontsContainer.innerHTML = emptyMsg;
    return;
  }

  scannedData.fonts.forEach((font, index) => {
    const html = `
      <div class="vic-font-item">
        <div class="vic-font-family" style="font-family: ${font.family}, sans-serif;">${font.family}</div>
        <div class="vic-font-details">
          <span>${font.weight}</span>
          <span>•</span>
          <span>${font.size}</span>
          <span>•</span>
          <span style="color:${font.color}">${font.color}</span>
        </div>
      </div>
    `;
    
    // 全部 Tab 只展示前 3 个最主要的字体
    if (index < 3) {
      allFontsContainer.innerHTML += html;
    }
    // 字体 Tab 展示所有
    fullFontsContainer.innerHTML += html;
  });
}

function renderColors() {
  const allColorsContainer = document.getElementById('vic-all-colors-container');
  const fullColorsContainer = document.getElementById('vic-colors-container');
  const colorFormat = document.getElementById('vic-color-format') ? document.getElementById('vic-color-format').value : 'hex';
  
  allColorsContainer.innerHTML = '';
  fullColorsContainer.innerHTML = '';

  if (scannedData.colors.length === 0) {
    const emptyMsg = '<div style="color:#86868b;font-size:12px;">未检测到明显颜色</div>';
    allColorsContainer.innerHTML = emptyMsg;
    fullColorsContainer.innerHTML = emptyMsg;
    return;
  }

  // 获取当前视图模式
  const isGridView = document.getElementById('vic-view-grid').classList.contains('active');

  scannedData.colors.forEach((hex, index) => {
    let displayValue = hex;
    if (colorFormat === 'rgb') {
       displayValue = hexToRgb(hex) || hex;
    }

    // 1. 渲染全部 Tab 的缩略宫格 (前 10 个颜色)
    if (index < 10) {
      const gridItem = document.createElement('div');
      gridItem.className = 'vic-color-item';
      gridItem.innerHTML = `
        <div class="vic-color-block" style="background-color: ${hex}"></div>
        <span class="vic-color-hex">${displayValue}</span>
      `;
      gridItem.addEventListener('click', () => copyToClipboard(displayValue));
      allColorsContainer.appendChild(gridItem);
    }

    // 2. 渲染颜色 Tab
    if (isGridView) {
      const gridItem = document.createElement('div');
      gridItem.className = 'vic-color-item';
      gridItem.innerHTML = `
        <div class="vic-color-block" style="background-color: ${hex}"></div>
        <span class="vic-color-hex">${displayValue}</span>
      `;
      gridItem.addEventListener('click', () => copyToClipboard(displayValue));
      fullColorsContainer.appendChild(gridItem);
    } else {
      const listItem = document.createElement('div');
      listItem.className = 'vic-color-list-item';
      listItem.innerHTML = `
        <div class="vic-color-list-block" style="background-color: ${hex}"></div>
        <span class="vic-color-list-hex">${displayValue}</span>
        <span class="vic-copy-icon">📋 复制</span>
      `;
      listItem.addEventListener('click', () => copyToClipboard(displayValue));
      fullColorsContainer.appendChild(listItem);
    }
  });
}

function renderAssets() {
  const container = document.getElementById('vic-assets-container');
  container.innerHTML = '';

  if (scannedData.assets.length === 0) {
    container.innerHTML = '<div style="color:#86868b;font-size:12px;grid-column:1/-1;">未检测到图片素材</div>';
    document.getElementById('vic-export-assets-btn').style.display = 'none';
    return;
  }

  document.getElementById('vic-export-assets-btn').style.display = 'block';

  const filterVal = document.getElementById('vic-assets-filter') ? document.getElementById('vic-assets-filter').value : 'all';

  let displayAssets = scannedData.assets;
  if (filterVal === 'svg') {
    displayAssets = scannedData.assets.filter(url => url.includes('.svg') || url.startsWith('data:image/svg'));
  } else if (filterVal === 'img') {
    displayAssets = scannedData.assets.filter(url => !url.includes('.svg') && !url.startsWith('data:image/svg'));
  }

  if (displayAssets.length === 0) {
     container.innerHTML = '<div style="color:#86868b;font-size:12px;grid-column:1/-1;">当前分类下无素材</div>';
     return;
  }

  displayAssets.forEach((url, index) => {
    const item = document.createElement('div');
    item.className = 'vic-asset-item';
    
    // 处理相对路径
    let imgSrc = url;
    if (url.startsWith('//')) {
      imgSrc = window.location.protocol + url;
    } else if (url.startsWith('/')) {
      imgSrc = window.location.origin + url;
    }
    
    item.innerHTML = `
      <img src="${imgSrc}" loading="lazy" alt="Asset">
      <button class="vic-asset-download-btn" data-url="${imgSrc}">⬇ 下载</button>
    `;
    
    item.querySelector('.vic-asset-download-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      downloadSingleAsset(imgSrc, index);
    });
    
    container.appendChild(item);
  });
}

// ==========================================
// 辅助与下载功能
// ==========================================
function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast(`✅ 已复制: ${text}`);
  });
}

function showToast(message) {
  const toast = document.getElementById('vic-toast');
  if (!toast) return;
  toast.textContent = message;
  toast.style.opacity = '1';
  setTimeout(() => {
    toast.style.opacity = '0';
  }, 2000);
}

function downloadSingleAsset(url, index) {
  const filename = getFilenameFromUrl(url, `asset_${index}`);
  chrome.runtime.sendMessage({
    action: 'downloadFile',
    url: url,
    filename: `Inspiration_Assets/${filename}`
  });
  showToast('开始下载...');
}

async function exportAssetsAsZip() {
  if (typeof JSZip === 'undefined') {
    showToast('❌ JSZip 库未加载，无法导出');
    return;
  }
  
  showToast('正在打包压缩，请稍候...');
  const zip = new JSZip();
  const folder = zip.folder("Inspiration_Assets");
  
  let promises = scannedData.assets.map(async (url, index) => {
    let fetchUrl = url;
    if (url.startsWith('//')) fetchUrl = window.location.protocol + url;
    else if (url.startsWith('/')) fetchUrl = window.location.origin + url;

    try {
      if (fetchUrl.startsWith('data:')) {
        // 处理 Base64
        const parts = fetchUrl.split(',');
        if (parts.length < 2) return;
        const mimeMatch = parts[0].match(/:(.*?);/);
        let ext = 'png';
        if (mimeMatch && mimeMatch[1]) {
          const type = mimeMatch[1].split('/')[1];
          if (type) ext = type.split('+')[0]; // 处理 svg+xml
        }
        const b64Data = parts[1];
        folder.file(`asset_${index}.${ext}`, b64Data, {base64: true});
      } else {
        // 处理普通 URL，尝试 fetch 转换为 blob
        const response = await fetch(fetchUrl);
        const blob = await response.blob();
        const filename = getFilenameFromUrl(fetchUrl, `asset_${index}`);
        folder.file(filename, blob);
      }
    } catch (e) {
      console.error('无法打包素材:', fetchUrl, e);
    }
  });

  await Promise.all(promises);
  
  zip.generateAsync({type:"blob"}).then(function(content) {
    const zipUrl = URL.createObjectURL(content);
    const a = document.createElement("a");
    a.href = zipUrl;
    a.download = `Inspiration_Assets_${new Date().getTime()}.zip`;
    a.click();
    showToast('✅ 打包下载完成！');
    URL.revokeObjectURL(zipUrl);
  });
}

function getFilenameFromUrl(url, fallback) {
  if (!url) return `${fallback}.png`;
  
  if (url.startsWith('data:')) {
    const mimeMatch = url.match(/data:image\/(.*?);/);
    const ext = mimeMatch && mimeMatch[1] ? mimeMatch[1].split('+')[0] : 'png';
    return `${fallback}.${ext}`;
  }
  try {
    // 尝试解析带协议的 URL
    let urlObj;
    if (url.startsWith('//')) {
      urlObj = new URL(window.location.protocol + url);
    } else if (url.startsWith('/')) {
      urlObj = new URL(window.location.origin + url);
    } else if (url.startsWith('http')) {
      urlObj = new URL(url);
    } else {
      urlObj = new URL(url, window.location.href);
    }
    const pathname = urlObj.pathname;
    const parts = pathname.split('/');
    let lastPart = parts[parts.length - 1];
    
    // 如果没有扩展名，尝试通过响应头或默认 png
    if (lastPart && lastPart.includes('.')) {
      // 移除可能的 query string (尽管 URL 对象已经处理了部分)
      return lastPart.split('?')[0];
    }
  } catch(e) {}
  return `${fallback}.png`;
}

// ==========================================
// 工具函数 (颜色转换等)
// ==========================================
function parseRGB(rgbStr) {
  if (!rgbStr || rgbStr === 'rgba(0, 0, 0, 0)' || rgbStr === 'transparent') return null;
  const match = rgbStr.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (!match) return null;
  const alpha = match[4] !== undefined ? parseFloat(match[4]) : 1;
  if (alpha === 0) return null;
  return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];
}

function rgbToHex(rgbArray) {
  if (!rgbArray) return null;
  return '#' + rgbArray.map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase();
}

function hexToRgb(hex) {
  // 简易 hex to rgb 转换
  let c;
  if(/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)){
      c= hex.substring(1).split('');
      if(c.length== 3){
          c= [c[0], c[0], c[1], c[1], c[2], c[2]];
      }
      c= '0x'+c.join('');
      return 'rgb('+[(c>>16)&255, (c>>8)&255, c&255].join(', ')+')';
  }
  return hex;
}

function mapFontWeight(weight) {
  const w = parseInt(weight);
  if (w <= 300) return 'Light';
  if (w === 400 || isNaN(w)) return 'Regular';
  if (w === 500) return 'Medium';
  if (w === 600) return 'SemiBold';
  if (w === 700) return 'Bold';
  if (w >= 800) return 'ExtraBold';
  return weight;
}

function isValidColor(hex) {
  // 过滤掉纯白纯黑和极度接近白黑的颜色（可选，这里为了展示丰富度，保留黑白，但去重）
  return hex && hex.length === 7;
}
}
