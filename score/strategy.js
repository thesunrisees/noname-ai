/*
 * ============================================
 * // Éditeur: Feisheng Original
 * 交流群: 123456789
 * v3.0
 * 版权所有，侵权必究
 * ============================================
 */

/* ============================================
 * ★ 策略模式：不同决策策略拆分
 * ============================================ */

/**
 * 攻击策略
 */
export function attackStrategy(me, target, card) {
    // 计算攻击价值
    let value = 0;
    if (target.hp <= 2) value += 5;  // 残血目标加分
    if (target.countCards('h') > 5) value += 2;  // 手牌多加分
    return value;
}

/**
 * 防御策略
 */
export function defenseStrategy(me, card) {
    // 计算防御价值
    let value = 0;
    if (me.hp <= 2) value += 5;  // 残血加分
    if (card.name === 'tao') value += 3;  // 桃加分
    return value;
}

/**
 * 辅助策略
 */
export function supportStrategy(me, ally, card) {
    // 计算辅助价值
    let value = 0;
    if (ally.hp <= 2) value += 5;  // 残血队友加分
    return value;
}

/**
 * 策略选择器
 */
export function chooseStrategy(me, context) {
    const hpRatio = me.hp / me.maxHp;
    
    if (hpRatio < 0.3) {
        return { type: 'defense', value: defenseStrategy };
    } else if (hpRatio > 0.7) {
        return { type: 'attack', value: attackStrategy };
    } else {
        return { type: 'support', value: supportStrategy };
    }
}
