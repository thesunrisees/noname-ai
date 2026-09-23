/* ================= 决策点注册表 =================
 * 所有需要决策的点都注册在这里。
 * trust = 接管信任度（0~1），由 Bandit 自动调整。
 */

export const DECISION_REGISTRY = {
    /* 四大核心决策（不参与 Bandit 自动调整） */
    chooseToUse:     { name: '出牌用牌',     trust: 1.0, skip: true },
    chooseToRespond: { name: '响应问牌',     trust: 1.0, skip: true },
    chooseToDiscard: { name: '弃牌选择',     trust: 1.0, skip: true },
    chooseToCompare: { name: '拼点出牌',     trust: 1.0, skip: true },

    /* 其他决策点（参与 Bandit 自动调整） */
    chooseToGive:       { name: '给牌选择',       trust: 0.8, skip: false },
    chooseToGuanxing:    { name: '观星排序',       trust: 0.8, skip: false },
    chooseToPindian:    { name: '拼点选择',       trust: 0.8, skip: false },
    chooseToCharacter:  { name: '选将选择',       trust: 0.8, skip: false },
    chooseToSkill:      { name: '选技能选择',     trust: 0.8, skip: false },
    chooseToMove:       { name: '移动牌选择',     trust: 0.8, skip: false },

    /* 底层 AI 决策 */
    chooseButton:   { name: '选技能按钮',   trust: 0.7, skip: false },
    chooseCard:     { name: '选卡牌',       trust: 0.7, skip: false },
    chooseTarget:   { name: '选目标',       trust: 0.7, skip: false },

    /* 其他选择 */
    chooseControl:  { name: '选选项',       trust: 0.6, skip: false },
    chooseBool:      { name: '选是/否',     trust: 0.6, skip: false },
    choosePlayerCard:{ name: '选玩家卡牌',   trust: 0.6, skip: false },
    chooseNumbers:   { name: '选数字',       trust: 0.6, skip: false },
};

/* 获取某个决策点的 trust */
export function getTrust(name) {
    try {
        if (!DECISION_REGISTRY[name]) return 1.0;
        return DECISION_REGISTRY[name].trust;
    } catch (e) { return 1.0; }
}

/* 设置某个决策点的 trust */
export function setTrust(name, trust) {
    try {
        if (!DECISION_REGISTRY[name]) return;
        if (trust < 0) trust = 0;
        if (trust > 1) trust = 1;
        DECISION_REGISTRY[name].trust = trust;
    } catch (e) {}
}

/* 列出所有决策点 */
export function listDecisionPoints() {
    const out = [];
    for (const name in DECISION_REGISTRY) {
        out.push({
            name: name,
            label: DECISION_REGISTRY[name].name,
            trust: DECISION_REGISTRY[name].trust,
            skip: DECISION_REGISTRY[name].skip,
        });
    }
    return out;
}

/* 挂到全局 */
if (typeof window !== 'undefined') {
    window.__DJSC = window.__DJSC || {};
    window.__DJSC.decision = {
        getTrust,
        setTrust,
        listDecisionPoints,
    };
}
