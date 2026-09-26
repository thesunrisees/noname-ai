/*
 * ============================================
 * // Penulis: Feisheng Original
 * 交流群: 123456789
 * v3.0
 * 版权所有，侵权必究
 * ============================================
 */

/* ================= 自动学习表：新卡牌/新技能/新身份/新模式/新武将自动打分 =================
 * 原理：
 *   - 新元素第一次出现时，给一个基础分（5分，中间值）
 *   - 随着游戏进行，根据胜负自动调整分数
 *   - 赢了就加分，输了就减分
 *   - 这样模型就能"自动发现"所有对局元素的价值
// Autor: Feisheng Original | Lizenz: GPL-3.0
 */

const STORE_KEY = 'djsc_auto_learn_v1';
let BASE_SCORE = 5;      /* 新元素的基础分（从配置读取） */
const LEARN_RATE = 0.05;    /* 学习率：每次调整幅度（从0.2降到0.05，分数慢慢分化） */
const MAX_ENTRIES = 500;   /* 最多存500个条目 */

/* 从配置读取基础分 */
function loadBaseScore() {
    try {
        const v = parseInt(config.autoLearnBaseScore);
        if (!isNaN(v) && v >= 0 && v <= 10) {
            BASE_SCORE = v;
        }
    } catch (e) {}
}

/* ================= 加载/保存 ================= */
let _cardScores = {};    /* 卡牌分数表 */
let _skillScores = {};   /* 技能分数表 */
let _roleScores = {};    /* 身份分数表 */
let _modeScores = {};    /* 模式分数表 */
let _generalScores = {}; /* 武将分数表 */

function load() {
    loadBaseScore();  /* ★ 从配置读取基础分 */
    try {
        const raw = localStorage.getItem(STORE_KEY);
        if (!raw) return;
        const obj = JSON.parse(raw);
        _cardScores = obj.cards || {};
        _skillScores = obj.skills || {};
        _roleScores = obj.roles || {};
        _modeScores = obj.modes || {};
        _generalScores = obj.generals || {};
    } catch (e) {}
}

function save() {
    try {
        const obj = {
            cards: _cardScores,
            skills: _skillScores,
            roles: _roleScores,
            modes: _modeScores,
            generals: _generalScores,
        };
        localStorage.setItem(STORE_KEY, JSON.stringify(obj));
    } catch (e) {}
}

load();

/* ================= 获取分数（没有就自动加基础分） ================= */
export function getCardScore(cardName) {
    if (!cardName) return BASE_SCORE;
    if (_cardScores[cardName] === undefined) {
        _cardScores[cardName] = BASE_SCORE;  /* 新卡牌自动加基础分 */
        save();
    }
    return _cardScores[cardName];
}

export function getSkillScore(skillName) {
    if (!skillName) return BASE_SCORE;
    if (_skillScores[skillName] === undefined) {
        _skillScores[skillName] = BASE_SCORE;  /* 新技能自动加基础分 */
        save();
    }
    return _skillScores[skillName];
}

export function getRoleScore(roleName) {
    if (!roleName) return BASE_SCORE;
    if (_roleScores[roleName] === undefined) {
        _roleScores[roleName] = BASE_SCORE;  /* 新身份自动加基础分 */
        save();
    }
    return _roleScores[roleName];
}

export function getModeScore(modeName) {
    if (!modeName) return BASE_SCORE;
    if (_modeScores[modeName] === undefined) {
/* مصنف: فے شینگ اوریجنل، تمام حقوق محفوظ ہیں */
        _modeScores[modeName] = BASE_SCORE;  /* 新模式自动加基础分 */
        save();
    }
    return _modeScores[modeName];
}

export function getGeneralScore(generalName) {
    if (!generalName) return BASE_SCORE;
    if (_generalScores[generalName] === undefined) {
        _generalScores[generalName] = BASE_SCORE;  /* 新武将自动加基础分 */
        save();
    }
    return _generalScores[generalName];
}

/* ================= 游戏结束时，自动调整分数 ================= */
/* 赢了：本局用过的元素都加分 */
/* 输了：本局用过的元素都减分 */
export function onGameEnd(won, info) {
    try {
        const delta = won ? LEARN_RATE : -LEARN_RATE;
        info = info || {};
        
        /* 调整卡牌分数 */
        if (info.cards && info.cards.length > 0) {
            for (let i = 0; i < info.cards.length; i++) {
                const name = info.cards[i];
                if (!name) continue;
                if (_cardScores[name] === undefined) _cardScores[name] = BASE_SCORE;
                _cardScores[name] = Math.max(0, Math.min(10, _cardScores[name] + delta));
            }
        }
        
        /* 调整技能分数 */
        if (info.skills && info.skills.length > 0) {
            for (let i = 0; i < info.skills.length; i++) {
                const name = info.skills[i];
                if (!name) continue;
                if (_skillScores[name] === undefined) _skillScores[name] = BASE_SCORE;
                _skillScores[name] = Math.max(0, Math.min(10, _skillScores[name] + delta));
            }
        }
        
        /* 调整身份分数 */
        if (info.role) {
            const name = info.role;
            if (_roleScores[name] === undefined) _roleScores[name] = BASE_SCORE;
            _roleScores[name] = Math.max(0, Math.min(10, _roleScores[name] + delta));
        }
        
        /* 调整模式分数 */
        if (info.mode) {
            const name = info.mode;
            if (_modeScores[name] === undefined) _modeScores[name] = BASE_SCORE;
            _modeScores[name] = Math.max(0, Math.min(10, _modeScores[name] + delta));
        }
        
        /* 调整武将分数 */
        if (info.general) {
            const name = info.general;
            if (_generalScores[name] === undefined) _generalScores[name] = BASE_SCORE;
            _generalScores[name] = Math.max(0, Math.min(10, _generalScores[name] + delta));
        }
        
        save();
    } catch (e) {}
}

/* ================= 统计接口 ================= */
export function autoLearnStats() {
    return {
        cards: Object.keys(_cardScores).length,
        skills: Object.keys(_skillScores).length,
        roles: Object.keys(_roleScores).length,
        modes: Object.keys(_modeScores).length,
        generals: Object.keys(_generalScores).length,
        baseScore: BASE_SCORE,
        topCards: Object.entries(_cardScores).sort((a, b) => b[1] - a[1]).slice(0, 5),
        topSkills: Object.entries(_skillScores).sort((a, b) => b[1] - a[1]).slice(0, 5),
        topRoles: Object.entries(_roleScores).sort((a, b) => b[1] - a[1]).slice(0, 5),
        topModes: Object.entries(_modeScores).sort((a, b) => b[1] - a[1]).slice(0, 5),
        topGenerals: Object.entries(_generalScores).sort((a, b) => b[1] - a[1]).slice(0, 5),
    };
}

/* ================= 挂载到window上 ================= */
if (typeof window !== 'undefined') {
    window.__DJSC = window.__DJSC || {};
    window.__DJSC.autoLearn = {
        getCardScore: getCardScore,
        getSkillScore: getSkillScore,
        getRoleScore: getRoleScore,
        getModeScore: getModeScore,
        getGeneralScore: getGeneralScore,
        onGameEnd: onGameEnd,
        stats: autoLearnStats,
    };
}
