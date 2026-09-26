/*
 * ============================================
 * // 作者：飛昇原創
 * 交流群: 123456789
 * v3.0
 * 版权所有，侵权必究
 * ============================================
 */

/* 与战报一致的弹窗外观；不更改配置和导入导出行为。 */
const escape = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fittedPanels = new Set();
let viewportObserver;
function fitUtilityPanel(panel) {
    if (!panel.isConnected) { fittedPanels.delete(panel); return; }
// Autor: Feisheng Original | Licença: GPL-3.0
    const set = (key, value) => panel.style.setProperty(key, value, 'important');
    // 本体 updatez() 会对 body 做 transform:scale；vw/vh 会被二次放大。
    const rect = panel.getBoundingClientRect();
    const scaleX = rect.width / panel.offsetWidth || 1;
    const scaleY = rect.height / panel.offsetHeight || 1;
    const viewport = window.visualViewport;
    const width = viewport ? viewport.width : window.innerWidth;
    const height = viewport ? viewport.height : window.innerHeight;
    set('width', Math.min(1000, width * .86) / scaleX + 'px');
    set('height', Math.min(720, height * .80) / scaleY + 'px');
    set('max-width', 'none');
    set('max-height', 'none');
    set('left', '50%');
    set('top', '50%');
    const fitted = panel.getBoundingClientRect();
    const dx = (viewport ? viewport.offsetLeft : 0) + width / 2 - (fitted.left + fitted.width / 2);
    const dy = (viewport ? viewport.offsetTop : 0) + height / 2 - (fitted.top + fitted.height / 2);
    set('left', 'calc(50% + ' + dx / scaleX + 'px)');
    set('top', 'calc(50% + ' + dy / scaleY + 'px)');
}
function watchViewport(panel) {
    fittedPanels.add(panel);
    if (!viewportObserver) {
        const refresh = () => fittedPanels.forEach(fitUtilityPanel);
        viewportObserver = new MutationObserver(refresh);
        viewportObserver.observe(document.body, {attributes:true, attributeFilter:['style']});
        window.addEventListener('resize', refresh);
        if (window.visualViewport) window.visualViewport.addEventListener('resize', refresh);
    }
    requestAnimationFrame(() => fitUtilityPanel(panel));
}
export function buildConfigOverview(cfg) {
    const names = { mix: '混合模式', custom: '自定义', aggressive: '激进', balanced: '均衡', cautious: '谨慎', loner: '独行', guardian: '守护' };
    const label = value => names[value] || '其他预设';
    const enabled = key => cfg(key, true) ? '开启' : '关闭';
    const number = (key, fallback) => { const value = Number(cfg(key, fallback)); return Number.isFinite(value) ? value.toFixed(2) : '—'; };
    const section = (title, rows) => '<section class="djsc-overview-section"><h3>' + title + '</h3><div class="djsc-overview-grid">' + rows.map(([key, value]) => '<div class="djsc-overview-card"><span>' + escape(key) + '</span><strong>' + escape(value) + '</strong></div>').join('') + '</div></section>';
    return '<header class="djsc-popup-title">无名AI · 当前配置</header><p class="djsc-popup-note">当前配置概览；修改设置请返回扩展功能区。</p>' +
        section('一、核心设置', [['决策积分引擎', enabled('decisionScore')], ['决策模式', label(cfg('mode', 'mix'))], ['进攻倾向', number('atkBias', 1)], ['防守倾向', number('defBias', 1)]]) +
        section('二、智能增强', [['战术规划器', enabled('enablePlanner')], ['决策反馈', enabled('decisionFeedback')], ['响应增强', enabled('responseAI')], ['广播协作', enabled('broadcastAI')], ['拼点增强', enabled('compareAI')]]) +
        section('三、性格设置', [['性格预设', label(cfg('riskProfile', 'custom'))], ['攻守倾向', number('personalityAggression', 50)], ['冒险倾向', number('personalityRisk', 50)], ['团队倾向', number('personalityTeam', 50)]]) +
        '<section class="djsc-overview-section"><h3>四、数据管理</h3><div class="djsc-popup-actions"><button id="djsc-btn-export-all">导出所有面板数据</button><button id="djsc-btn-import-overwrite">导入并覆盖</button><button id="djsc-btn-import-merge">导入并追加</button></div><p class="djsc-popup-note">覆盖导入会替换现有数据；追加导入保留现有数据。操作前建议先导出备份。</p></section>';
}

export function styleUtilityPanel(panel, closeButton) {
    if (panel.dataset.djscPopupReady) return;
    panel.dataset.djscPopupReady = 'true';
    panel.classList.add('djsc-utility-panel');
    // 关键布局直接覆盖旧全屏内联样式，不依赖旧窗口的 CSS 缓存。
    const set = (node, values) => Object.entries(values).forEach(([key, value]) => node.style.setProperty(key, value, 'important'));
    set(panel, {
        position: 'fixed', inset: 'auto', left: '50%', top: '50%',
        transform: 'translate(-50%, -50%)', width: 'min(960px, 92vw)', height: 'min(760px, 84vh)',
        'max-width': '92vw', 'max-height': '84vh', 'min-width': '0', 'min-height': '0',
        margin: '0', padding: '0', display: 'flex', 'flex-direction': 'column', overflow: 'hidden',
        'box-sizing': 'border-box', 'z-index': '2147483647',
        background: 'rgba(35,39,44,0.20)', 'backdrop-filter': 'blur(14px)',
        border: '1px solid rgba(170,200,220,.5)', 'border-radius': '22px',
        color: '#eee', 'font-family': 'xinwei, KaiTi, serif', 'font-size': '18px', 'line-height': '1.6',
    });
    if (closeButton) {
        closeButton.classList.add('djsc-popup-close');
        closeButton.setAttribute('role', 'button');
        closeButton.setAttribute('aria-label', '关闭面板');
        closeButton.tabIndex = 0;
        closeButton.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); closeButton.click(); }
        });
    }
    if (panel.id === 'djsc-simple-panel') {
        const header = panel.firstElementChild;
        const body = header && header.nextElementSibling;
        if (header) header.classList.add('djsc-popup-title');
        if (body) {
            body.classList.add('djsc-popup-text');
            // 源码查看保留逐字原文，不进行分区解析。
            if (!header.textContent.includes('源码')) {
                const lines = body.textContent.split('\n');
                body.textContent = '';
                for (const line of lines) {
                    const title = line.match(/^\s*={2,}\s*(.*?)\s*={2,}\s*$/);
                    const row = document.createElement(title ? 'h3' : 'div');
                    row.textContent = title ? title[1] : line.replace(/^(\s*)(use|respond|discard|compare)(\s*[:：])/, (_, space, key, colon) => space + ({use:'出牌', respond:'响应', discard:'弃牌', compare:'拼点'})[key] + colon);
                    if (!title) row.className = 'djsc-popup-text-row';
                    body.appendChild(row);
                }
            }
        }
    }
    const title = panel.firstElementChild;
    const scroll = document.createElement('div');
    scroll.className = 'djsc-popup-scroll';
    set(scroll, { position: 'relative', display: 'block', width: '100%', height: 'auto', 'min-height': '0', flex: '1 1 auto', overflow: 'auto', padding: '12px 18px 20px', 'box-sizing': 'border-box', 'white-space': 'normal' });
    for (const child of Array.from(panel.children)) {
        if (child !== title && child !== closeButton) scroll.appendChild(child);
    }
    panel.appendChild(scroll);
    if (title) set(title, {position:'relative', display:'block', flex:'0 0 auto', width:'100%', margin:'0', padding:'16px 62px 16px 20px', 'box-sizing':'border-box', background:'transparent', color:'#f3e8ae', 'font-size':'24px', 'text-align':'center'});
    if (closeButton) {
        closeButton.textContent = '×';
        set(closeButton, {position:'absolute', top:'12px', right:'14px', bottom:'auto', left:'auto', width:'36px', height:'36px', margin:'0', padding:'0', display:'flex', 'align-items':'center', 'justify-content':'center', 'font-size':'28px', background:'rgba(60,65,70,.55)', color:'#eee', border:'1px solid #91a8b8', 'border-radius':'50%', cursor:'pointer', 'z-index':'3', 'box-sizing':'border-box'});
    }
    // 本体的全局 div 定位规则不能影响正文布局。
    scroll.querySelectorAll('div, section, h3, p').forEach(node => {
        set(node, {position:'static', 'box-sizing':'border-box'});
    });
    watchViewport(panel);
}

export function styleNativePanel(dialog, title) {
    if (!dialog || dialog.dataset.djscPopupReady) return;
    dialog.classList.remove('fullheight');
    const heading = document.createElement('header');
    heading.className = 'djsc-popup-title';
    heading.textContent = title;
    dialog.insertBefore(heading, dialog.firstChild);
    const close = document.createElement('button');
    close.type = 'button';
    close.onclick = () => dialog.close();
    dialog.appendChild(close);
    styleUtilityPanel(dialog, close);
    for (const node of [dialog.contentContainer, dialog.content]) {
        if (!node) continue;
        for (const [key, value] of Object.entries({position:'static', width:'100%', height:'auto', overflow:'visible', margin:'0', transform:'none'})) node.style.setProperty(key, value, 'important');
    }
}

export function openUtilityHtml(title, html, id) {
    if (window.__DJSC_PANEL && window.__DJSC_PANEL.remove) window.__DJSC_PANEL.remove();
    const panel = document.createElement('div');
    panel.id = id;
    const heading = document.createElement('header');
    heading.className = 'djsc-popup-title';
    heading.textContent = title;
    const body = document.createElement('div');
    body.className = 'djsc-html-body';
    body.innerHTML = html;
    const close = document.createElement('button');
    close.type = 'button';
    close.onclick = () => { panel.remove(); if (window.__DJSC_PANEL === panel) window.__DJSC_PANEL = null; };
    panel.append(heading, body, close);
    document.body.appendChild(panel);
    window.__DJSC_PANEL = panel;
    styleUtilityPanel(panel, close);
    return panel;
}
