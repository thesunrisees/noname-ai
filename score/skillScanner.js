/* ================= 技能扫描器 · 对象-方法交叉判定 =================
 * 核心：符号由"对谁做"决定，不由"做了什么"决定
 *   player.draw(2)  → draw: +2      （自己摸牌）
 *   target.draw(2)  → feedDraw: -2  （资敌摸牌）
 *   target.damage() → damage: +2    （对敌伤害）
 *   player.damage() → selfDamage:-2 （自伤）
 */

const METHOD_POLARITY = {
    draw: +1, gain: +1, gainPlayerCard: +1, gainMultiple: +1,
    recover: +1, gainMaxHp: +1, revive: +1,
    addSkill: +1, addTempSkill: +1, addShan: +1, addMark: +1,
    damage: -1, loseHp: -1, loseMaxHp: -1,
    discard: -1, lose: -1, loseCard: -1, remove: -1,
    turnOver: -1, link: -1, skip: -1,
    die: -1, out: -1,
    changeHp: 0,  // 参数符号决定
};

const DUAL_TAGS = {
    draw: { self: 'draw', enemy: 'feedDraw' },
    gain: { self: 'gain', enemy: 'feedGain' },
    gainPlayerCard: { self: 'gain', enemy: 'feedGain' },
    gainMultiple: { self: 'gain', enemy: 'feedGain' },
    recover: { self: 'recover', enemy: 'feedRecover' },
    gainMaxHp: { self: 'maxHp', enemy: 'feedHp' },
    revive: { self: 'revive', enemy: 'feedRecover' },
    addSkill: { self: 'addSkill', enemy: 'feedSkill' },
    addTempSkill: { self: 'addTempSkill', enemy: 'feedSkill' },
    addShan: { self: 'addShan', enemy: 'feedSkill' },
    addMark: { self: 'mark', enemy: 'feedMark' },
    damage: { self: 'selfDamage', enemy: 'damage' },
    loseHp: { self: 'loseHp', enemy: 'loseEnemyHp' },
    loseMaxHp: { self: 'loseMaxHp', enemy: 'loseEnemyMaxHp' },
    discard: { self: 'selfDiscard', enemy: 'discardEnemy' },
    lose: { self: 'selfLose', enemy: 'loseEnemy' },
    loseCard: { self: 'selfLose', enemy: 'loseEnemy' },
    remove: { self: 'selfRemove', enemy: 'loseEnemy' },
    turnOver: { self: 'selfTurnOver', enemy: 'turnOver' },
    link: { self: 'selfLink', enemy: 'link' },
    skip: { self: 'selfSkip', enemy: 'skip' },
    die: { self: 'selfDie', enemy: 'damage' },
    out: { self: 'selfOut', enemy: 'loseEnemy' },
    changeHp: { self: 'changeHp', enemy: 'changeHp', argsSensitive: true },
};

/* 对象我方性 */
const SELF_RE = [/^(player|self|me|this|_trueMe)$/, /^(event|trigger|evt)\.player$/, /^player\._trueMe$/];
const TEAM_RE = [/\.getFriends\(\)$/, /\.getAllies\(\)$/, /^getFriendsOf\(/, /^getAlliesOf\(/];
const TARGET_RE = [/^(target|tgt|victim)$/, /^(event|trigger|evt)\.(target|targets\[0\])$/];
const TARGETS_RE = [/^targets$/, /^(event|trigger|evt)\.targets$/];
const ENEMY_RE = [/\.getEnemies\(\)$/, /^getEnemiesOf\(/];
const DYING_RE = [/^(dying|event\.dying|trigger\.dying)$/];
const SOURCE_RE = [/^(source|src)$/, /^(event|trigger|evt)\.source$/];
const ALL_RE = [/^(game\.players|players)$/];

function _match(expr, res) { for (let i = 0; i < res.length; i++) if (res[i].test(expr)) return true; return false; }

function _objAllegiance(expr) {
    if (!expr) return null;
    expr = String(expr).replace(/\s+/g, '').replace(/^(event|trigger|evt)\./, '');
    if (_match(expr, TEAM_RE)) return +2;   // 队友
    if (_match(expr, SELF_RE)) return +1;   // 自己
    if (_match(expr, ENEMY_RE)) return -1;
    if (_match(expr, TARGET_RE)) return -1;
    if (_match(expr, TARGETS_RE)) return -1;
    if (_match(expr, DYING_RE)) return -1;
    if (_match(expr, SOURCE_RE)) return 0;
    if (_match(expr, ALL_RE)) return 0;
    const root = /^([A-Za-z_$][\w$]*)/.exec(expr);
    if (root && root[1] !== expr) return _objAllegiance(root[1]);
    return null;
}

function _findBalanced(src, openIdx, open, close) {
    if (src[openIdx] !== open) return -1;
    let depth = 0, inStr = false, strCh = '', inLC = false, inBC = false;
    for (let i = openIdx; i < src.length; i++) {
        const c = src[i], n = src[i + 1];
        if (inLC) { if (c === '\n') inLC = false; continue; }
        if (inBC) { if (c === '*' && n === '/') { inBC = false; i++; } continue; }
        if (inStr) { if (c === '\\') { i++; continue; } if (c === strCh) inStr = false; continue; }
        if (c === '/' && n === '/') { inLC = true; i++; continue; }
        if (c === '/' && n === '*') { inBC = true; i++; continue; }
        if (c === '"' || c === "'" || c === '`') { inStr = true; strCh = c; continue; }
        if (c === open) depth++;
        else if (c === close) { depth--; if (depth === 0) return i; }
    }
    return -1;
}

/* 提取直接调用 X.method( */
function _extractDirect(src) {
    const out = [];
    const re = /\b([A-Za-z_$][\w$]*(?:\s*\.\s*[A-Za-z_$][\w$]*|\[\s*[^\]]+\s*\])*)\s*\.\s*([a-z][A-Za-z0-9_]*)\s*\(/g;
    let m;
    while ((m = re.exec(src))) {
        out.push({
            kind: 'direct',
            object: m[1].replace(/\s+/g, ''),
            method: m[2],
            index: m.index,
            argIndex: m.index + m[0].length,
        });
        if (m.index === re.lastIndex) re.lastIndex++;
    }
    return out;
}

/* 提取 forEach 内层调用 */
function _extractForEach(src) {
    const out = [];
    const re = /\b([A-Za-z_$][\w$]*(?:\s*\.\s*[A-Za-z_$][\w$]*|\[\s*[^\]]+\s*\])*)\s*\.\s*forEach\s*\(/g;
    let m;
    while ((m = re.exec(src))) {
        const outer = m[1].replace(/\s+/g, '');
        const openIdx = m.index + m[0].length - 1;
        const closeIdx = _findBalanced(src, openIdx, '(', ')');
        if (closeIdx < 0) { re.lastIndex = m.index + 1; continue; }
        const body = src.slice(openIdx + 1, closeIdx);
        const fnM = /^\s*(?:function\s*)?\(?\s*([A-Za-z_$][\w$]*)\s*\)?\s*(?:=>)?/.exec(body);
        if (!fnM) { re.lastIndex = closeIdx + 1; continue; }
        const iterVar = fnM[1];
        const bodyCode = body.slice(fnM[0].length);
        const esc = iterVar.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const innerRe = new RegExp('\\b' + esc + '\\s*\\.\\s*([a-z][A-Za-z0-9_]*)\\s*\\(', 'g');
        let im;
        while ((im = innerRe.exec(bodyCode))) {
            out.push({
                kind: 'foreach',
                object: iterVar,
                method: im[1],
                index: openIdx + 1 + fnM[0].length + im.index,
                argIndex: openIdx + 1 + fnM[0].length + im.index + im[0].length,
                outerExpr: outer,
                bodyContext: bodyCode,
                bodyIndex: im.index,
            });
        }
        re.lastIndex = closeIdx + 1;
    }
    return out;
}

function _extractAll(src) {
    const inner = _extractForEach(src);
    const innerIdx = new Set(inner.map(function (c) { return c.index; }));
    const direct = _extractDirect(src).filter(function (c) {
        if (innerIdx.has(c.index)) return false;
        if (/^(p|cur|current|x|t|item|i|j|k|elem|el)$/.test(c.object)) return false;
        return true;
    });
    const all = direct.concat(inner);
    const seen = new Set();
    const out = [];
    for (const c of all) {
        const k = c.kind + '|' + c.object + '|' + c.method + '|' + c.index;
        if (seen.has(k)) continue;
        seen.add(k);
        out.push(c);
    }
    return out;
}

/* 收集 get.attitude(_, X) 约束 */
function _buildAttMap(src) {
    const map = Object.create(null);
    const re = /get\s*\.\s*attitude\s*\(\s*[^,)]+,\s*([A-Za-z_$][\w$]*(?:\s*\.\s*[A-Za-z_$][\w$]*|\[\s*[^\]]+\s*\])*)\s*\)\s*([<>]=?|===?)\s*(-?\d+(?:\.\d+)?)/g;
    let m;
    while ((m = re.exec(src))) {
        const name = m[1].replace(/\s+/g, '').replace(/^(event|trigger|evt)\./, '');
        const op = m[2], v = Number(m[3]);
        let sign = null;
        if ((op === '>' || op === '>=') && v >= 0) sign = +2;
        else if ((op === '<' || op === '<=') && v <= 0) sign = -1;
        else if ((op === '==' || op === '===') && v > 0) sign = +2;
        else if ((op === '==' || op === '===') && v < 0) sign = -1;
        if (sign !== null) {
            if (!map[name]) map[name] = [];
            map[name].push({ sign: sign, pos: m.index });
        }
    }
    return map;
}

function _argSignForChangeHp(src, argIdx) {
    const tail = src.slice(argIdx, argIdx + 60);
    const m = /^\s*(-?\s*(?:\d+(?:\.\d+)?|[A-Za-z_$][\w$]*))/.exec(tail);
    if (!m) return 0;
    const tok = m[1].replace(/\s+/g, '');
    if (tok.startsWith('-')) return -1;
    if (tok === '0') return 0;
    return +1;
}

function _collectEv(call, src, attMap) {
    const ev = [];

    /* E1 显式对象名 */
    const a1 = _objAllegiance(call.object);
    if (a1 !== null && a1 !== 0) ev.push({ type: 'object', sign: a1, weight: 1.0 });

    /* E2 外层集合 */
    if (call.kind === 'foreach') {
        const a2 = _objAllegiance(call.outerExpr);
        if (a2 !== null && a2 !== 0) ev.push({ type: 'outer', sign: a2, weight: 0.7 });
    }

    /* E3 态度映射 */
    const varKey = String(call.object).replace(/\s+/g, '').replace(/^(event|trigger|evt)\./, '');
    const atts = attMap[varKey];
    if (atts && atts.length) {
        const near = atts.slice().sort(function (a, b) {
            return Math.abs(a.pos - call.index) - Math.abs(b.pos - call.index);
        }).slice(0, 3);
        if (near.length) {
            const avg = near.reduce(function (s, a) { return s + a.sign; }, 0) / near.length;
            ev.push({ type: 'attitude', sign: avg, weight: 0.9 });
        }
    }

    /* E4 参数符号 */
    if (METHOD_POLARITY[call.method] === 0 && call.argIndex !== undefined) {
        const s = _argSignForChangeHp(src, call.argIndex);
        if (s !== 0) ev.push({ type: 'param', sign: s, weight: 0.6 });
    }

    return ev;
}

function _combineEv(ev) {
    if (!ev || !ev.length) return null;
    let sum = 0, total = 0, hasTeam = false, hasEnemy = false, hasSelf = false;
    for (const e of ev) {
        sum += e.sign * e.weight;
        total += e.weight;
        if (e.sign === +2) hasTeam = true;
        if (e.sign === -1) hasEnemy = true;
        if (e.sign === +1) hasSelf = true;
    }
    if (total < 0.01) return null;
    const avg = sum / total;
    if (avg > 0.3) {
        if (hasTeam && !hasSelf) return +2;
        if (hasTeam && hasSelf) return +2;
        return +1;
    }
    if (avg < -0.3) return -1;
    return 0;
}

/* 时机权重（只影响权重，不影响符号） */
const TIMING_W = {
    dying: 1.6, damageAfter: 1.3, damaged: 1.2, chooseToRespond: 1.2,
    phaseUse: 1.0, phaseDraw: 1.0, useCard: 1.0, chooseToUse: 1.0,
    phaseZhunbei: 0.9, phaseDiscard: 0.9, phaseJieshu: 0.9, judge: 0.9, passive: 0.85, die: 0.3,
};

function _timingWeight(ctx) {
    if (!ctx || !ctx.skill) return 1.0;
    const trg = ctx.skill.trigger;
    let max = 1.0;
    const visit = function (n) {
        if (typeof n !== 'string') return;
        if (TIMING_W[n] && TIMING_W[n] > max) max = TIMING_W[n];
    };
    if (typeof trg === 'string') visit(trg);
    else if (Array.isArray(trg)) trg.forEach(visit);
    else if (trg && typeof trg === 'object') {
        for (const k in trg) {
            if (!trg[k]) continue;
            visit(k);
            if (typeof trg[k] === 'string') visit(trg[k]);
            if (Array.isArray(trg[k])) trg[k].forEach(visit);
        }
    }
    return max;
}

/* 团队联动关键词 */
const TEAM_CHAIN_KW = ['jizhi', 'qingnang', 'leiji', 'fankui', 'ganglie',
    'yiji', 'jianxiong', 'luoyi', 'longdan', 'qicai', 'yingzi', 'biyue',
    'guicai', 'guidao', 'xiaoji'];

function _hasTeamChain(src) {
    for (const kw of TEAM_CHAIN_KW) {
        if (new RegExp('["\'`]' + kw + '["\'`]').test(src)) return true;
    }
    return false;
}

function _hasAoeNoFilter(src) {
    const hasLoop = /\.forEach\s*\(/.test(src) || /for\s*\(\s*(?:const|let|var)\s+\w+\s+of\s+/.test(src);
    if (!hasLoop) return false;
    if (/get\s*\.\s*attitude/.test(src)) return false;
    return /game\s*\.\s*players\.forEach|for\s*\(\s*(?:const|let|var)\s+\w+\s+of\s+game\s*\.\s*players/.test(src);
}

/**
 * 主入口：扫描源码，输出标签
 * @param {string} source
 * @param {object} [ctx] { sid, skill }
 * @returns {object} tags
 */
export function scanObjectMethod(source, ctx) {
    const out = {};
    if (!source || typeof source !== 'string') return out;
    if (source.length > 30000) source = source.slice(0, 30000);

    /* 纯 AI 技能早退 */
    if (ctx && ctx.skill) {
        const sk = ctx.skill;
        if (sk.silent && (sk.charlotte || sk.superCharlotte) && !sk.content && !sk.viewAs && !sk.trigger) {
            return out;
        }
    }

    const calls = _extractAll(source);
    if (!calls.length) return out;

    const attMap = _buildAttMap(source);
    const timingW = _timingWeight(ctx);

    for (const call of calls) {
        const pol = METHOD_POLARITY[call.method];
        if (pol === undefined) continue;
        const dual = DUAL_TAGS[call.method];
        if (!dual) continue;

        const ev = _collectEv(call, source, attMap);
        if (!ev.length) continue;

        const alleg = _combineEv(ev);
        if (alleg === null || alleg === 0) continue;

        let effPol = pol;
        if (dual.argsSensitive) {
            const p = ev.find(function (x) { return x.type === 'param'; });
            if (!p) continue;
            effPol = p.sign;
        }
        if (effPol === 0) continue;

        const tag = alleg >= +1 ? dual.self : dual.enemy;
        if (!tag) continue;

        const sign = alleg >= +1 ? effPol : -effPol;
        const w = timingW;

        out[tag] = (out[tag] || 0) + sign * w;

        /* ★ 团队维度叠加 */
        if (alleg === +2) {
            if (effPol > 0) {
                out.teamGain = (out.teamGain || 0) + 1.2 * timingW;
                if (call.method === 'recover' || call.method === 'revive' || call.method === 'gainMaxHp') {
                    out.teamAid = (out.teamAid || 0) + 1.6 * timingW;
                }
            } else if (effPol < 0) {
                out.teamHurt = (out.teamHurt || 0) - 1.4 * timingW;
            }
        }
    }

    /* 全局团队信号 */
    if (_hasAoeNoFilter(source)) out.teamRisk = (out.teamRisk || 0) - 0.5;
    if (_hasTeamChain(source)) out.teamChain = (out.teamChain || 0) + 0.9;

    /* 饱和化 + 舍入 */
    for (const k in out) {
        if (Math.abs(out[k]) > 3) {
            out[k] = Math.sign(out[k]) * (3 + Math.log(Math.abs(out[k]) - 2));
        }
        out[k] = Math.round(out[k] * 100) / 100;
    }

    return out;
}
