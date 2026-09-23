/* ================= 决策积分引擎 · 决策解释器 2.0 =================
 * 把引擎内部的信号翻译成人话：
 *   ① 主因解释：因为…所以…
 *   ② 反事实：如果…就会…
 *   ③ 置信度可视化：模型62% / 熟悉80%
 */
import { lib, game, get, _status } from '../../../../../noname.js';
import { cfg } from '../misc/util.js';
import { log } from '../misc/logger.js';

/* ================= 主入口：生成解释 ================= */
export function narrate(entry) {
    try {
        if (!entry && _status && _status.djsc_lastBest) {
            entry = {
                winner: _status.djsc_lastBest,
                candidates: _status.djsc_lastCandidates || [],
                meta: _status.djsc_lastMeta || null,
                confidence: _status.djsc_lastConfidence || null,
            };
        }
        if (!entry || !entry.winner) return null;

        const w = entry.winner;
        const facts = [];
        const counterfactual = [];

        /* ① 动作主体 */
        const actionText = _describeAction(w);

        /* ② 主因：从 candidates[0] 的 reason 里抽取关键信息 */
        const mainReason = _extractReason(w.reason || '');
        if (mainReason) facts.push(mainReason);

        /* ③ 目标价值 */
        if (w.target) {
            const targetFact = _describeTarget(w, entry);
            if (targetFact) facts.push(targetFact);
        }

        /* ④ 置信度 */
        if (entry.meta && entry.confidence) {
            const confText = _describeConfidence(entry);
            if (confText) facts.push(confText);
        }

        /* ⑤ 反事实：和次选对比 */
        if (entry.candidates && entry.candidates.length >= 2) {
            const second = entry.candidates[1];
            const gap = (w.score || 0) - (second.score || 0);
            if (Math.abs(gap) < 1.5 && second.id !== w.id) {
                counterfactual.push(_describeAlternative(w, second, gap));
            }
        }

        /* ⑥ 特殊场景（击杀窗口、濒死救援） */
        const special = _describeSpecialScene(w, entry);
        if (special) facts.push(special);

        return {
            action: actionText,
            facts: facts,
            counterfactual: counterfactual,
            winner: w,
        };
    } catch (e) {
        return null;
    }
}

/* ================= 描述动作 ================= */
function _describeAction(w) {
    try {
        if (!w) return '未知动作';
        const type = w.type;
        const id = w.id || '';
        const name = (lib.translate && lib.translate[id]) || id;
        const tgt = w.target ? ('→ ' + w.target) : '';
        if (type === 'card') return '使用【' + name + '】' + tgt;
        if (type === 'skill') return '发动技能' + name + tgt;
        if (type === 'equip') return '装备' + name + tgt;
        if (type === 'end') return '结束回合';
        return type + ':' + id + tgt;
    } catch (e) { return '动作'; }
}

/* ================= 从 reason 里抽取主因 ================= */
function _extractReason(reason) {
    try {
        if (!reason) return '';
        /* 常见的 reason 格式："使用杀→张三（目标分8）（EV5 边际3）" */
        /* 提取关键短语 */
        let out = '';

        /* 目标分 */
        const tsMatch = reason.match(/目标分\s*(-?\d+(?:\.\d+)?)/);
        if (tsMatch) {
            const ts = parseFloat(tsMatch[1]);
            if (ts >= 8) out += '目标价值极高（' + ts + '）；';
            else if (ts >= 5) out += '目标价值高（' + ts + '）；';
        }

        /* EV */
        const evMatch = reason.match(/EV\s*(-?\d+(?:\.\d+)?)/);
        if (evMatch) {
            const ev = parseFloat(evMatch[1]);
            if (ev >= 5) out += '期望收益高（EV ' + ev + '）；';
        }

        /* 覆盖信号 */
        const ovMatch = reason.match(/覆写:([^)]+)/);
        if (ovMatch) out += '引擎评分支持（' + ovMatch[1].slice(0, 30) + '）；';

        /* 心理战/连招标记 */
        if (reason.indexOf('群体+') >= 0) out += '公共知识库加成；';
        if (reason.indexOf('击杀窗口') >= 0) out += '存在击杀窗口；';
        if (reason.indexOf('接近击杀') >= 0) out += '接近击杀；';

        return out.replace(/；$/, '');
    } catch (e) { return ''; }
}

/* ================= 描述目标 ================= */
function _describeTarget(w, entry) {
    try {
        if (!w.target) return '';
        const tgt = _findPlayer(w.target);
        if (!tgt) return '';

        const hp = tgt.hp || 0;
        const maxHp = tgt.maxHp || 4;
        const parts = [];

        if (hp <= 1) parts.push('残血（HP ' + hp + '）');
        else if (hp <= 2) parts.push('血量低（HP ' + hp + '）');

        /* 手牌推断 */
        try {
            const pShan = window.__DJSC.probHasShan ? window.__DJSC.probHasShan(tgt) : null;
            if (pShan !== null && pShan < 0.3) parts.push('大概率没闪');
            else if (pShan !== null && pShan > 0.7) parts.push('大概率有闪');
        } catch (e) {}

        /* 装备 */
        try {
            const equips = tgt.getCards ? tgt.getCards('e') : [];
            const names = equips.map(function (e) { return get.name(e); });
            if (names.indexOf('zhuge') >= 0) parts.push('带连弩（威胁高）');
            if (names.indexOf('tengjia') >= 0) parts.push('有藤甲');
        } catch (e) {}

        /* 仇恨度 */
        try {
            const mem = window.__DJSC.playerMemory;
            if (mem && mem.hostility) {
                const h = mem.hostility(tgt);
                if (h > 0.5) parts.push('历史多次攻击我');
            }
        } catch (e) {}

        return parts.length ? '目标：' + parts.join('、') : '';
    } catch (e) { return ''; }
}

/* ================= 描述置信度 ================= */
function _describeConfidence(entry) {
    try {
        const meta = entry.meta;
        const conf = entry.confidence;
        if (!meta) return '';
        const fami = Math.round((meta.familiarity || 0) * 100);
        const level = meta.level;
        let txt = '熟悉度 ' + fami + '%（' + _levelName(level) + '）';
        if (conf && conf.confidence !== undefined) {
            txt += '；模型置信 ' + Math.round(conf.confidence * 100) + '%';
        }
        if (entry.intervention) {
            txt += '；干预 ' + _interventionName(entry.intervention);
        }
        return txt;
    } catch (e) { return ''; }
}

function _levelName(level) {
    if (level === 'high') return '很熟';
    if (level === 'mid') return '一般';
    if (level === 'low') return '陌生';
    return '未知';
}
function _interventionName(iv) {
    if (iv === 'model') return '模型主导';
    if (iv === 'blend') return '规则+模型混合';
    if (iv === 'rule') return '规则主导';
    if (iv === 'skip') return '跳过模型';
    return iv;
}

/* ================= 反事实 ================= */
function _describeAlternative(w, second, gap) {
    try {
        const secondName = (lib.translate && lib.translate[second.id]) || second.id;
        const secondDesc = _describeAction({ type: second.type, id: second.id, target: second.target });
        const diff = Math.abs(gap).toFixed(1);

        /* 根据差值方向描述 */
        if (gap > 0) {
            return '次选「' + secondDesc + '」仅落后 ' + diff + ' 分，若局势稍有变化可能改用此方案';
        } else {
            return '次选「' + secondDesc + '」略优 ' + diff + ' 分，由于其它信号被压制';
        }
    } catch (e) { return ''; }
}

/* ================= 特殊场景 ================= */
function _describeSpecialScene(w, entry) {
    try {
        /* 濒死救援 */
        if (w.id === 'tao' && w.type === 'card') {
            const dying = (game.players || []).find(function (p) {
                return p && p.alive !== false && (p.hp || 0) <= 0;
            });
            if (dying) return '队友濒死，紧急救援';
        }
        /* AOE 残局 */
        if ((w.id === 'nanman' || w.id === 'wanjian') && w.type === 'card') {
            const alive = (game.players || []).filter(function (p) { return p && p.alive !== false; }).length;
            if (alive <= 4) return '残局 AOE 收人头';
        }
        /* 结束回合 */
        if (w.type === 'end') {
            const hc = _currentPhaseHand();
            if (hc > 0) return '当前手牌 ' + hc + ' 张，保留资源过冬';
        }
        return '';
    } catch (e) { return ''; }
}

function _currentPhaseHand() {
    try {
        const me = _status.currentPhase || game.me;
        return me && me.countCards ? me.countCards('h') : 0;
    } catch (e) { return 0; }
}

/* ================= 查找玩家 ================= */
function _findPlayer(key) {
    try {
        if (!key) return null;
        for (const p of (game.players || [])) {
            if (!p) continue;
            if ((p.name1 || p.name || '') === key) return p;
        }
    } catch (e) {}
    return null;
}

/* ================= 渲染成 HTML ================= */
export function renderNarrateHtml(entry) {
    try {
        const n = narrate(entry);
        if (!n) return '<div style="color:#888; font-size:11px;">无法解释（无决策信号）</div>';

        let h = '<div style="font-size:12px; color:#dbe7f5; padding:8px 10px; background:rgba(154,216,255,0.06); border-left:3px solid #9ad8ff; border-radius:4px; margin:6px 0; line-height:1.7;">';

        h += '<div style="color:#7fe3a0; font-weight:bold; margin-bottom:4px;">▶ ' + n.action + '</div>';

        if (n.facts.length) {
            h += '<div style="color:#dbe7f5; margin:3px 0;">';
            n.facts.forEach(function (f, i) {
                h += '<div>· ' + _esc(f) + '</div>';
            });
            h += '</div>';
        }

        if (n.counterfactual.length) {
            h += '<div style="color:#ffd479; margin-top:6px; font-size:11px;">';
            n.counterfactual.forEach(function (c) {
                h += '<div>💭 ' + _esc(c) + '</div>';
            });
            h += '</div>';
        }

        h += '</div>';
        return h;
    } catch (e) {
        return '<div style="color:#888; font-size:11px;">解释生成异常</div>';
    }
}

function _esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* ================= 查询最近 N 条解释 ================= */
export function recentNarrations(n) {
    try {
        const D = window.__DJSC;
        if (!D || !D.getDecisionLog) return [];
        const log = D.getDecisionLog() || [];
        return log.slice(-(n || 5)).reverse().map(function (e) {
            return { entry: e, narration: narrate(e) };
        }).filter(function (x) { return x.narration; });
    } catch (e) { return []; }
}

/* ================= 弹窗式快速查看 ================= */
export function showRecentNarrations(n) {
    try {
        const list = recentNarrations(n || 5);
        if (!list.length) { alert('最近没有决策记录'); return; }
        let html = '<div style="font-size:12px; padding:8px;">';
        list.forEach(function (x, i) {
            html += '<div style="border-bottom:1px dashed #2a3a5a; padding:6px 0;">';
            html += '<div style="color:#9ad8ff; font-size:11px;">【决策 ' + (i + 1) + '】</div>';
            html += renderNarrateHtml(x.entry);
            html += '</div>';
        });
        html += '</div>';

        let dlg = null;
        try { dlg = ui.create.dialog('最近决策解释'); } catch (e) {}
        if (!dlg) { alert('面板打开失败'); return; }
        try {
            dlg.classList.add('fullheight');
            dlg.style.width = 'min(92vw, 640px)';
            dlg.style.maxWidth = '92vw';
            dlg.style.left = '4vw';
        } catch (e) {}
        const d = document.createElement('div');
        d.innerHTML = html;
        dlg.content.appendChild(d);
    } catch (e) { alert('解释面板异常：' + e.message); }
}

