/*
 * ============================================
 * // 著者: Feisheng Original
 * 交流群: 123456789
 * v3.0
 * 版权所有，侵权必究
 * ============================================
 */

/* 仅为左侧名称绑定本体说明弹窗，不改变右侧开关与按钮的行为。 */
export function installSettingsHelp(lib, ui, status = {}) {
    if (window.__djscSettingsHelpObserver) return;
    const bound = new WeakSet();
    const guarded = new WeakSet();
    const bind = root => {
// Autore: Feisheng Originale | Licenza: GPL-3.0
        if (!root.querySelectorAll) return;
        const labels = Array.from(root.querySelectorAll('.djsc-setting-name[data-djsc-help]'));
        if (root.matches && root.matches('.djsc-setting-name[data-djsc-help]')) labels.push(root);
        for (const label of labels) {
            if (bound.has(label)) continue;
            bound.add(label);
            lib.setIntro(label, dialog => {
                dialog.style.width = 'min(300px, 80vw)';
                const description = document.createElement('div');
                description.className = 'text';
                description.style.cssText = 'position:relative;line-height:1.65;white-space:normal;overflow-wrap:anywhere;text-align:left';
                // 编号分点独立成行；普通数字、小数及说明原文保持不变。
                const help = label.dataset.djscHelp || '';
                const lines = help.replace(/\s*([①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳])/g, '\n$1')
                    .replace(/(^|\s+)(\d+[、．]|\d+\.(?!\d)\s)/g, '$1\n$2')
                    .split(/\r?\n/).map(line => line.trim()).filter(Boolean);
                lines.forEach((line, index) => {
                    const paragraph = document.createElement('div');
                    paragraph.style.cssText = 'position:relative;display:block;width:auto;height:auto;white-space:normal;line-height:1.65;margin:' + (index ? '6px' : '0') + ' 0 0';
                    paragraph.textContent = line;
                    description.appendChild(paragraph);
                });
                dialog.add(description);
            });
            // 桌面触屏设备也支持长按；移动端 setIntro 已绑定长按。
            if (!lib.config.touchscreen) lib.setLongPress(label, ui.click.intro);
            label.addEventListener('touchstart', event => event.stopPropagation(), {passive:true});
            label.oncontextmenu = function (event) {
                event.preventDefault();
                event.stopPropagation();
                return ui.click.rightplayer.call(this, event);
            };
            label.tabIndex = 0;
            label.setAttribute('role', 'button');
            label.setAttribute('aria-label', label.textContent + '：查看说明');
            label.addEventListener('keydown', event => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault(); event.stopPropagation();
                    const rect = label.getBoundingClientRect();
                    ui.click.intro.call(label, new MouseEvent('click', {clientX:rect.left, clientY:rect.bottom}));
                }
            });
        }
        // 本体将 click/touchend 绑定在整行上，需在捕获阶段区分名称和右侧控件。
        const rows = Array.from(root.querySelectorAll('.config'));
        const parentRow = root.closest && root.closest('.config');
        if (parentRow) rows.push(parentRow);
        for (const row of rows) {
            if (guarded.has(row) || !row.querySelector('.djsc-setting-name')) continue;
            guarded.add(row);
            let lastTouch = 0;
            const guard = event => {
                const target = event.target;
                const label = target.closest && target.closest('.djsc-setting-name');
                const action = target.closest && target.closest('.djsc-setting-action');
                const chooser = row._link && row._link.choosing;
                const toggle = row.classList.contains('toggle') ? Array.from(row.children).find(node => node.tagName === 'DIV') : null;
                if (action || (chooser && chooser.contains(target)) || (toggle && toggle.contains(target))) return;
                event.stopImmediatePropagation();
                event.preventDefault();
                if (!label || !label.dataset.djscHelp) return;
                if (event.type === 'touchend') {
                    lastTouch = Date.now();
                    ui.click.longpresscancel.call(label);
                    if (status.dragged || status.longpressed) return;
                    const point = event.changedTouches && event.changedTouches[0];
                    const rect = label.getBoundingClientRect();
                    ui.click.intro.call(label, new MouseEvent('click', {clientX:point ? point.clientX : rect.left, clientY:point ? point.clientY : rect.bottom}));
                } else if (Date.now() - lastTouch > 600 && !status.longpressed) {
                    ui.click.intro.call(label, event);
                }
            };
            row.addEventListener('click', guard, true);
            row.addEventListener('touchend', guard, {capture:true, passive:false});
            row.addEventListener('contextmenu', event => {
                if (!event.target.closest('.djsc-setting-name[data-djsc-help]')) {
                    event.preventDefault(); event.stopImmediatePropagation();
                }
            }, true);
        }
    };
    bind(document.body);
    const observer = new MutationObserver(records => {
        for (const record of records) for (const node of record.addedNodes) bind(node);
    });
    observer.observe(document.body, {childList:true, subtree:true});
    window.__djscSettingsHelpObserver = observer;
}
