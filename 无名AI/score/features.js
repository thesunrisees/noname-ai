/* ================= 决策积分引擎 · 特征提取（训练蒸馏用） =================
 * 提取 48 维特征（32 维状态 + 16 维动作），用于线性回归蒸馏
 * 特征设计原则：
 *   1. 数值化（不要布尔，用 0/1）
 *   2. 归一化（尽量在 0~1 或 -1~1 范围）
 *   3. 稀疏度低（不要大量恒为 0 的维度）
 *   4. 包含动作特征，让模型能区分"杀队友"和"杀敌人"
 */

/* 特征维度定义（48 维） */
export const FEATURE_NAMES = [
    /* === 状态特征（0~31） === */
    /* 手牌相关（0~7） */
    'handCount',           // 0: 手牌数 / 10
    'handSizeRatio',       // 1: 手牌数 / 手牌上限
    'hasSha',              // 2: 有没有杀
    'hasShan',             // 3: 有没有闪
    'hasTao',              // 4: 有没有桃
    'hasWuxie',            // 5: 有没有无懈
    'hasJuedou',           // 6: 有没有决斗
    'hasNanmanOrWanjian',  // 7: 有没有AOE

    /* 血量相关（8~11） */
    'hpRatio',             // 8: 血量 / 血量上限
    'hpLow',               // 9: 血量 <= 2
    'hpVeryLow',           // 10: 血量 <= 1
    'isDying',             // 11: 是否濒死

    /* 身份/阵营相关（12~15） */
    'isZhu',               // 12: 是否主公
    'isZhong',             // 13: 是否忠臣
    'isFan',               // 14: 是否反贼
    'isNei',               // 15: 是否内奸

    /* 场上局势相关（16~22） */
    'aliveCount',          // 16: 存活人数 / 8
    'enemyCount',          // 17: 敌方人数 / 4
    'allyCount',           // 18: 友方人数 / 4
    'allyLowHp',           // 19: 友方残血人数
    'enemyLowHp',          // 20: 敌方残血人数
    'enemyHasZhuge',       // 21: 敌方有没有连弩
    'enemyHasTengjia',     // 22: 敌方有没有藤甲

    /* 装备相关（23~26） */
    'hasWeapon',           // 23: 有没有武器
    'hasArmor',            // 24: 有没有防具
    'hasMount',            // 25: 有没有坐骑
    'hasZhuge',            // 26: 有没有连弩

    /* 阶段/回合相关（27~29） */
    'roundNumber',         // 27: 回合数 / 10
    'isEarlyStage',        // 28: 早期（前 3 回合）
    'isEndgame',           // 29: 残局（<= 4 人）

    /* 资源/经济相关（30~31） */
    'hasWuzhong',          // 30: 有没有无中生有
    'hasTiesuo',           // 31: 有没有铁索连环

    /* === 动作特征（32~47） === */
    /* 动作类型（32~35） */
    'act_card',            // 32: 出牌
    'act_skill',           // 33: 用技能
    'act_equip',           // 34: 装备
    'act_end',              // 35: 结束回合

    /* 牌名映射（36~41） */
    'atk_card',            // 36: 攻击牌（杀/决斗/火攻/AOE/指鹿）
    'def_card',            // 37: 防御牌（闪/桃/无懈/酒）
    'ctrl_card',           // 38: 控制牌（过河/顺手/乐/兵/铁索）
    'is_sha',              // 39: 是不是杀
    'is_tao',              // 40: 是不是桃
    'is_wuxie',            // 41: 是不是无懈

    /* 目标特征（42~47） */
    'target_isAlly',       // 42: 目标是友方
    'target_isEnemy',      // 43: 目标是敌方
    'target_hpRatio',      // 44: 目标血量比
    'target_handCount',    // 45: 目标手牌数 / 10
    'target_score',        // 46: 目标评分 / 15
    'is_focus',             // 47: 是否是集火目标
];

export const FEATURE_DIM = FEATURE_NAMES.length;  // 48

/* ★ 提取特征向量 */
export function extractFeatures(me, act, ctx) {
    const f = new Float32Array(FEATURE_DIM);
    try {
        /* ===== f[0..31] 状态特征（保持不动） ===== */
        /* === 手牌相关 === */
        const hand = me.getCards('h') || [];
        const handCount = hand.length;
        const handLimit = me.getHandcardLimit ? me.getHandcardLimit() : 5;
        f[0] = handCount / 10;
        f[1] = handCount / Math.max(1, handLimit);

        /* 统计关键牌 */
        let sha = 0, shan = 0, tao = 0, wuxie = 0, juedou = 0, aoe = 0, wuzhong = 0, tiesuo = 0;
        hand.forEach(function (c) {
            const n = c.name;
            if (n === 'sha') sha++;
            else if (n === 'shan') shan++;
            else if (n === 'tao') tao++;
            else if (n === 'wuxie') wuxie++;
            else if (n === 'juedou') juedou++;
            else if (n === 'nanman' || n === 'wanjian') aoe++;
            else if (n === 'wuzhong') wuzhong++;
            else if (n === 'tiesuo') tiesuo++;
        });
        f[2] = sha > 0 ? 1 : 0;
        f[3] = shan > 0 ? 1 : 0;
        f[4] = tao > 0 ? 1 : 0;
        f[5] = wuxie > 0 ? 1 : 0;
        f[6] = juedou > 0 ? 1 : 0;
        f[7] = aoe > 0 ? 1 : 0;

        /* === 血量相关 === */
        const hp = me.hp || 0;
        const maxHp = me.maxHp || 1;
        f[8] = hp / maxHp;
        f[9] = hp <= 2 ? 1 : 0;
        f[10] = hp <= 1 ? 1 : 0;
        f[11] = hp <= 0 ? 1 : 0;

        /* === 身份相关 === */
        const identity = me.identity || '';
        f[12] = identity === 'zhu' ? 1 : 0;
        f[13] = identity === 'zhong' || identity === 'mingzhong' ? 1 : 0;
        f[14] = identity === 'fan' ? 1 : 0;
        f[15] = identity === 'nei' ? 1 : 0;

        /* === 场上局势相关 === */
        const players = game.players || [];
        let alive = 0, enemy = 0, ally = 0, allyLow = 0, enemyLow = 0;
        let enemyZhuge = 0, enemyTengjia = 0;
        players.forEach(function (p) {
            if (!p || p.alive === false) return;
            alive++;
            const att = get.attitude(me, p);
            if (p.hp <= 1) {
                if (att > 0) allyLow++;
                else if (att < 0) enemyLow++;
            }
            if (att > 0) ally++;
            else if (att < 0) {
                enemy++;
                if (p.getEquip && p.getEquip('zhuge')) enemyZhuge++;
                if (p.getEquip && p.getEquip('tengjia')) enemyTengjia++;
            }
        });
        f[16] = alive / 8;
        f[17] = enemy / 4;
        f[18] = ally / 4;
        f[19] = allyLow / 4;
        f[20] = enemyLow / 4;
        f[21] = enemyZhuge > 0 ? 1 : 0;
        f[22] = enemyTengjia > 0 ? 1 : 0;

        /* === 装备相关 === */
        const equips = me.getCards('e') || [];
        let hasWeapon = false, hasArmor = false, hasMount = false, hasZhuge = false;
        equips.forEach(function (c) {
            const subs = get.subtypes(c);
            if (subs.indexOf('equip1') >= 0) {
                hasWeapon = true;
                if (c.name === 'zhuge') hasZhuge = true;
            }
            if (subs.indexOf('equip2') >= 0) hasArmor = true;
            if (subs.indexOf('equip3') >= 0 || subs.indexOf('equip4') >= 0) hasMount = true;
        });
        f[23] = hasWeapon ? 1 : 0;
        f[24] = hasArmor ? 1 : 0;
        f[25] = hasMount ? 1 : 0;
        f[26] = hasZhuge ? 1 : 0;

        /* === 阶段/回合相关 === */
        const round = (_status && _status.roundNumber) || 0;
        f[27] = round / 10;
        f[28] = round <= 3 ? 1 : 0;
        f[29] = alive <= 4 ? 1 : 0;

        /* === 资源相关 === */
        f[30] = wuzhong > 0 ? 1 : 0;
        f[31] = tiesuo > 0 ? 1 : 0;

        /* ===== f[32..47] 动作特征 ===== */
        if (act) {
            /* 动作类型（32~35） */
            if (act.type === 'card') f[32] = 1;
            else if (act.type === 'skill') f[33] = 1;
            else if (act.type === 'equip') f[34] = 1;
            else if (act.type === 'end') f[35] = 1;

            /* 牌名映射（36~41） */
            const actId = act.id || '';
            const ATK_IDS = { sha:1, juedou:1, huogong:1, nanman:1, wanjian:1, zhujin:1, huosha:1, leisha:1 };
            const DEF_IDS = { shan:1, tao:1, wuxie:1, jiu:1, exjiu:1 };
            const CTRL_IDS = { guohe:1, shunshou:1, lebu:1, bingliang:1, tiesuo:1, jiedao:1 };
            if (ATK_IDS[actId]) f[36] = 1;
            if (DEF_IDS[actId]) f[37] = 1;
            if (CTRL_IDS[actId]) f[38] = 1;
            if (actId === 'sha' || actId === 'huosha' || actId === 'leisha') f[39] = 1;
            if (actId === 'tao') f[40] = 1;
            if (actId === 'wuxie') f[41] = 1;

            /* 目标特征（42~47） */
            const target = ctx && ctx.bestT;
            if (target) {
                let isAlly = false;
                try {
                    if (get.attitude(me, target) > 0) isAlly = true;
                } catch(e) {}
                f[42] = isAlly ? 1 : 0;
                f[43] = isAlly ? 0 : 1;
                f[44] = (target.hp || 0) / Math.max(1, target.maxHp || 1);
                const targetHand = target.getCards ? target.getCards('h').length : 0;
                f[45] = Math.min(1, targetHand / 10);
                f[46] = Math.min(1, Math.abs(ctx.bestTs || 0) / 15);
                f[47] = (act.target === (ctx.focusTarget && ctx.focusTarget.name1)) ? 1 : 0;
            }
        }

    } catch (e) {
        /* 出错时返回全 0 */
    }
    return f;
}

/* ★ 打印特征（调试用） */
export function printFeatures(f) {
    const out = [];
    for (let i = 0; i < f.length; i++) {
        out.push(FEATURE_NAMES[i] + '=' + (Math.round(f[i] * 100) / 100));
    }
    return out.join(', ');
}
