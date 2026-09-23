/* ================= 决策积分引擎 · 自动特征发现 =================
 * 让模型自己发现新的特征维度（黄线），而不是我们手动定义：
 *   ① 自动记录所有决策的"场景组合"
 *   ② 统计每种组合的胜率/收益
 *   ③ 收益显著偏离的组合自动标记为"重要特征"
 *   ④ 这些自动发现的特征会加进模型的输入
 */
import { lib, game, get, _status } from '../../../noname.js';
import { log } from '../core/logger.js';

/* ================= 存储 ================= */
const STORE_KEY = 'djsc_auto_features_v1';
const VERSION = 1;
let STORE = { v: VERSION, combos: {} };
let _loaded = false;

function _load() {
    try {
        if (_loaded) return;
        const raw = localStorage.getItem(STORE_KEY);
        if (raw) {
            const obj = JSON.parse(raw);
            if (obj && obj.v === VERSION) STORE = obj;
        }
        _loaded = true;
    } catch (e) { _loaded = true; }
}
function _save() {
    try {
        localStorage.setItem(STORE_KEY, JSON.stringify(STORE));
    } catch (e) {}
}

/* ================= 记录一次决策 ================= */
export function recordDecisionContext(context) {
    try {
        _load();
        if (!context) return;

        /* 把场景特征组合成一个 key */
        const key = _comboKey(context);
        if (!key) return;

        if (!STORE.combos[key]) {
            STORE.combos[key] = {
                count: 0,
                totalReward: 0,
                wins: 0,
                lastSeen: Date.now(),
            };
        }

        STORE.combos[key].count++;
        STORE.combos[key].lastSeen = Date.now();

        /* 保留最近 500 个组合 */
        const keys = Object.keys(STORE.combos);
        if (keys.length > 500) {
            keys.sort(function (a, b) {
                return STORE.combos[a].lastSeen - STORE.combos[b].lastSeen;
            });
            for (let i = 0; i < keys.length - 500; i++) {
                delete STORE.combos[keys[i]];
            }
        }

        _save();
    } catch (e) {}
}

/* ================= 对局结束后回填收益 ================= */
export function settleDecisionContext(context, reward, win) {
    try {
        _load();
        if (!context) return;

        const key = _comboKey(context);
        if (!key || !STORE.combos[key]) return;

        STORE.combos[key].totalReward += reward;
        if (win) STORE.combos[key].wins++;

        _save();
    } catch (e) {}
}

/* ================= 组合成 key ================= */
function _comboKey(context) {
    try {
        const parts = [];

        /* ① 卡牌类型 */
        if (context.cardType) parts.push('t:' + context.cardType);
        /* ①b 卡牌细节 */
        if (context.cardSuit) parts.push('suit:' + context.cardSuit);  // 花色：黑/红/梅/方
        if (context.cardIsSameSuit) parts.push('sameSuit');            // 同花色（火攻用）

        /* ② 目标关系 */
        if (context.targetIsAlly) parts.push('ally');
        if (context.targetIsEnemy) parts.push('enemy');

        /* ③ 自己状态 */
        if (context.myLowHp) parts.push('myLowHp');
        if (context.myHighHp) parts.push('myHighHp');
        if (context.myFewHand) parts.push('myFewHand');
        if (context.myManyHand) parts.push('myManyHand');
        if (context.myHasWeapon) parts.push('myHasWeapon');
        if (context.myHasArmor) parts.push('myHasArmor');
        if (context.myHasZhuge) parts.push('myHasZhuge');      // 有连弩
        if (context.myHasTengjia) parts.push('myHasTengjia');  // 有藤甲

        /* ③b 回合内状态 */
        if (context.myShaUsed) parts.push('myShaUsed');        // 这回合已经出过杀
        if (context.myCanShaAgain) parts.push('myCanShaAgain'); // 还能再出杀（连弩）
        if (context.mySkillUsed) parts.push('mySkillUsed');    // 这回合已经用过技能

        /* ④ 目标状态 */
        if (context.tgtLowHp) parts.push('tgtLowHp');
        if (context.tgtHighHp) parts.push('tgtHighHp');
        if (context.tgtFewHand) parts.push('tgtFewHand');
        if (context.tgtManyHand) parts.push('tgtManyHand');
        if (context.tgtHasWeapon) parts.push('tgtHasWeapon');
        if (context.tgtHasArmor) parts.push('tgtHasArmor');
        if (context.tgtIsZhuge) parts.push('tgtIsZhuge');
        if (context.tgtIsTengjia) parts.push('tgtIsTengjia');
        if (context.tgtHasMount) parts.push('tgtHasMount');    // 有坐骑（+1/-1）

        /* ④b 判定区状态 */
        if (context.tgtHasJudge) parts.push('tgtHasJudge');    // 目标判定区有牌
        if (context.tgtHasLebu) parts.push('tgtHasLebu');      // 目标有乐不思蜀
        if (context.tgtHasBing) parts.push('tgtHasBing');      // 目标有兵粮寸断

        /* ⑤ 距离/位置 */
        if (context.distNear) parts.push('distNear');
        if (context.distFar) parts.push('distFar');
        if (context.isFirstMove) parts.push('firstMove');
        if (context.isLastMove) parts.push('lastMove');

        /* ⑥ 局势 */
        if (context.isEndgame) parts.push('endgame');
        if (context.isMidgame) parts.push('midgame');
        if (context.isEarly) parts.push('early');
        if (context.allyFew) parts.push('allyFew');            // 友方快没人了
        if (context.enemyFew) parts.push('enemyFew');          // 敌方快没人了

        /* ⑦ 身份 */
        if (context.myIdentity) parts.push('my:' + context.myIdentity);
        if (context.tgtIdentity) parts.push('tgt:' + context.tgtIdentity);

        /* ⑧ 对手行为 */
        if (context.tgtAggressive) parts.push('tgtAggro');
        if (context.tgtCautious) parts.push('tgtCautious');
        if (context.tgtAttackedMe) parts.push('tgtAttackedMe'); // 这个玩家之前打过我

        /* ⑨ 牌堆 */
        if (context.deckFew) parts.push('deckFew');
        if (context.deckMany) parts.push('deckMany');
        if (context.discardHasKey) parts.push('discardHasKey');

        /* ⑩ 手牌结构 */
        if (context.myAttackHeavy) parts.push('myAttackHeavy');    // 我攻击牌多
        if (context.myDefenseHeavy) parts.push('myDefenseHeavy');  // 我防御牌多
        if (context.myTrickHeavy) parts.push('myTrickHeavy');      // 我锦囊多
        if (context.myKeyHeavy) parts.push('myKeyHeavy');          // 我关键牌多（桃/无懈）

        /* ⑩b 目标手牌结构 */
        if (context.tgtAttackHeavy) parts.push('tgtAttackHeavy');  // 目标攻击牌多
        if (context.tgtDefenseHeavy) parts.push('tgtDefenseHeavy'); // 目标防御牌多
        if (context.tgtKeyHeavy) parts.push('tgtKeyHeavy');      // 目标关键牌多

        /* ⑪ 武将技能 */
        if (context.myHasSkill) parts.push('myHasSkill');        // 我有技能可用
        if (context.tgtHasSkill) parts.push('tgtHasSkill');      // 目标有技能
        if (context.tgtHasStrongSkill) parts.push('tgtStrongSkill'); // 目标有强技能

        /* ⑫ 时机/阶段 */
        if (context.isPlayEarly) parts.push('playEarly');        // 出牌阶段前期
        if (context.isPlayLate) parts.push('playLate');          // 出牌阶段后期
        if (context.isDiscardPhase) parts.push('discardPhase');  // 弃牌阶段

        /* ⑬ 装备组合 */
        if (context.myWeaponArmor) parts.push('myWeaponArmor');  // 我有武器+防具
        if (context.tgtWeaponMount) parts.push('tgtWeaponMount'); // 目标有武器+坐骑

        /* ⑭ 历史行为 */
        if (context.tgtUsedShaLast) parts.push('tgtUsedShaLast'); // 目标上轮出过杀
        if (context.tgtUsedTaoLast) parts.push('tgtUsedTaoLast'); // 目标上轮出过桃
        if (context.tgtAttackedAlly) parts.push('tgtAttackedAlly'); // 目标打过队友

        /* ⑮ 阵营关系 */
        if (context.allyInDanger) parts.push('allyInDanger');    // 友方有危险
        if (context.enemyInDanger) parts.push('enemyInDanger');  // 敌方有危险
        if (context.isMainTarget) parts.push('isMainTarget');    // 我是主敌方

        /* ⑯ 卡牌点数 */
        if (context.cardLowNum) parts.push('cardLowNum');      // 小点数（≤5）
        if (context.cardMidNum) parts.push('cardMidNum');      // 中点数（6~10）
        if (context.cardHighNum) parts.push('cardHighNum');    // 大点数（J~A）

        /* ⑰ 武将血量 */
        if (context.myFullHp) parts.push('myFullHp');          // 我满血
        if (context.myHalfHp) parts.push('myHalfHp');          // 我半血
        if (context.tgtFullHp) parts.push('tgtFullHp');        // 目标满血
        if (context.tgtHalfHp) parts.push('tgtHalfHp');        // 目标半血

        /* ⑱ 回合数 */
        if (context.roundEarly) parts.push('roundEarly');      // 第1~3回合
        if (context.roundMid) parts.push('roundMid');          // 第4~6回合
        if (context.roundLate) parts.push('roundLate');        // 第7回合以后

        /* ⑲ 玩家数量 */
        if (context.players8) parts.push('players8');         // 8人局
        if (context.players6) parts.push('players6');         // 6人局
        if (context.players4) parts.push('players4');         // 4人局
        if (context.players2) parts.push('players2');         // 2人局

        /* ⑳ 弃牌堆细节 */
        if (context.discardHasSha) parts.push('discardHasSha'); // 弃牌堆有杀
        if (context.discardHasShan) parts.push('discardHasShan'); // 弃牌堆有闪
        if (context.discardHasTao) parts.push('discardHasTao'); // 弃牌堆有桃
        if (context.discardHasWuxie) parts.push('discardHasWuxie'); // 弃牌堆有无懈

        /* ㉑ 局势判断 */
        if (context.weFavorable) parts.push('weFavorable');     // 我们优势
        if (context.weUnfavorable) parts.push('weUnfavorable'); // 我们劣势
        if (context.balance) parts.push('balance');           // 局势平衡

        /* ㉒ 队友状态 */
        if (context.allyFullHp) parts.push('allyFullHp');       // 队友满血
        if (context.allyLowHp) parts.push('allyLowHp');       // 队友残血
        if (context.allyManyHand) parts.push('allyManyHand');  // 队友手牌多
        if (context.allyFewHand) parts.push('allyFewHand');    // 队友手牌少

        /* ㉓ 卡牌稀有度 */
        if (context.cardRare) parts.push('cardRare');         // 稀有牌（无懈/桃）
        if (context.cardCommon) parts.push('cardCommon');      // 普通牌（杀/闪）

        /* ㉔ 身份暴露 */
        if (context.myIdentityKnown) parts.push('myIdKnown'); // 我身份已暴露
        if (context.tgtIdentityKnown) parts.push('tgtIdKnown'); // 目标身份已暴露

        /* ㉕ 玩家死亡顺序 */
        if (context.firstDeath) parts.push('firstDeath');     // 第一个死的
        if (context.lastDeath) parts.push('lastDeath');       // 最后一个死的

        /* ㉖ 装备价值 */
        if (context.myEquipValueHigh) parts.push('myEquipHigh');   // 我装备价值高
        if (context.myEquipValueLow) parts.push('myEquipLow');    // 我装备价值低
        if (context.tgtEquipValueHigh) parts.push('tgtEquipHigh'); // 目标装备价值高

        /* ㉗ 队友血量 */
        if (context.allyFullHp) parts.push('allyFullHp');   // 队友满血
        if (context.allyLowHp) parts.push('allyLowHp');   // 队友残血
        if (context.allyManyHand) parts.push('allyManyHand'); // 队友手牌多
        if (context.allyFewHand) parts.push('allyFewHand'); // 队友手牌少

        /* ㉘ 敌人血量 */
        if (context.enemyFullHp) parts.push('enemyFullHp'); // 敌人满血
        if (context.enemyLowHp) parts.push('enemyLowHp');   // 敌人残血
        if (context.enemyManyHand) parts.push('enemyManyHand'); // 敌人手牌多
        if (context.enemyFewHand) parts.push('enemyFewHand'); // 敌人手牌少

        /* ㉙ 卡牌效果 */
        if (context.cardEffective) parts.push('cardEffective'); // 卡牌有效果
        if (context.cardIneffective) parts.push('cardIneffective'); // 卡牌无效果

        /* ㉚ 技能状态 */
        if (context.mySkillReady) parts.push('mySkillReady'); // 我技能可用
        if (context.mySkillUsed) parts.push('mySkillUsed');   // 我技能已用
        if (context.tgtSkillReady) parts.push('tgtSkillReady'); // 目标技能可用

        /* ㉛ 牌堆剩余 */
        if (context.deck10) parts.push('deck10');   // 牌堆剩≤10张
        if (context.deck30) parts.push('deck30');   // 牌堆剩10~30张
        if (context.deckMany) parts.push('deckMany'); // 牌堆剩≥30张

        /* ㉜ 玩家风格 */
        if (context.playerAggro) parts.push('playerAggro'); // 玩家激进
        if (context.playerCautious) parts.push('playerCautious'); // 玩家保守
        if (context.playerBalanced) parts.push('playerBalanced'); // 玩家平衡

        /* ㉝ 卡牌花色 */
        if (context.cardSpade) parts.push('cardSpade');   // 黑桃
        if (context.cardHeart) parts.push('cardHeart');   // 红桃
        if (context.cardClub) parts.push('cardClub');     // 梅花
        if (context.cardDiamond) parts.push('cardDiamond'); // 方块

        /* ㉞ 装备类型 */
        if (context.myWeapon) parts.push('myWeapon');     // 我有武器
        if (context.myArmor) parts.push('myArmor');       // 我有防具
        if (context.myMount) parts.push('myMount');       // 我有坐骑
        if (context.tgtWeapon) parts.push('tgtWeapon');   // 目标有武器
        if (context.tgtArmor) parts.push('tgtArmor');     // 目标有防具
        if (context.tgtMount) parts.push('tgtMount');     // 目标有坐骑

        /* ㉟ 距离档位 */
        if (context.dist1) parts.push('dist1');           // 距离=1
        if (context.dist2) parts.push('dist2');           // 距离=2
        if (context.dist3) parts.push('dist3');           // 距离=3
        if (context.dist4plus) parts.push('dist4plus');   // 距离≥4

        /* ㊱ 身份 */
        if (context.myZhu) parts.push('myZhu');           // 我是主公
        if (context.myZhong) parts.push('myZhong');       // 我是忠臣
        if (context.myFan) parts.push('myFan');           // 我是反贼
        if (context.myNei) parts.push('myNei');          // 我是内奸
        if (context.tgtZhu) parts.push('tgtZhu');         // 目标是主公
        if (context.tgtZhong) parts.push('tgtZhong');     // 目标是忠臣
        if (context.tgtFan) parts.push('tgtFan');          // 目标是反贼
        if (context.tgtNei) parts.push('tgtNei');          // 目标是内奸

        /* ㊲ 手牌数量档位 */
        if (context.myHand0) parts.push('myHand0');       // 我没牌
        if (context.myHand1) parts.push('myHand1');       // 我1张牌
        if (context.myHand2) parts.push('myHand2');       // 我2张牌
        if (context.myHand3) parts.push('myHand3');       // 我3张牌
        if (context.myHand4plus) parts.push('myHand4plus'); // 我4+张牌
        if (context.tgtHand0) parts.push('tgtHand0');     // 目标没牌
        if (context.tgtHand1) parts.push('tgtHand1');     // 目标1张牌
        if (context.tgtHand2) parts.push('tgtHand2');     // 目标2张牌
        if (context.tgtHand3) parts.push('tgtHand3');     // 目标3张牌
        if (context.tgtHand4plus) parts.push('tgtHand4plus'); // 目标4+张牌

        /* ㊳ 血量档位 */
        if (context.myHp0) parts.push('myHp0');           // 我0血（濒死）
        if (context.myHp1) parts.push('myHp1');           // 我1血
        if (context.myHp2) parts.push('myHp2');           // 我2血
        if (context.myHp3) parts.push('myHp3');           // 我3血
        if (context.myHp4plus) parts.push('myHp4plus');   // 我4+血
        if (context.tgtHp0) parts.push('tgtHp0');         // 目标0血（濒死）
        if (context.tgtHp1) parts.push('tgtHp1');         // 目标1血
        if (context.tgtHp2) parts.push('tgtHp2');         // 目标2血
        if (context.tgtHp3) parts.push('tgtHp3');         // 目标3血
        if (context.tgtHp4plus) parts.push('tgtHp4plus'); // 目标4+血

        /* ㊴ 存活人数档位 */
        if (context.alive8) parts.push('alive8');         // 8人存活
        if (context.alive6) parts.push('alive6');         // 6人存活
        if (context.alive4) parts.push('alive4');         // 4人存活
        if (context.alive3) parts.push('alive3');         // 3人存活
        if (context.alive2) parts.push('alive2');         // 2人存活
        if (context.alive1) parts.push('alive1');         // 1人存活

        /* ㊵ 回合内已出牌数 */
        if (context.shaUsed0) parts.push('shaUsed0');     // 这回合没出过杀
        if (context.shaUsed1) parts.push('shaUsed1');     // 这回合出过1张杀
        if (context.shaUsed2plus) parts.push('shaUsed2plus'); // 这回合出过2+张杀

        /* ㊶ 判定区 */
        if (context.myJudge) parts.push('myJudge');       // 我判定区有牌
        if (context.tgtJudge) parts.push('tgtJudge');     // 目标判定区有牌

        /* ㊷ 阵营人数比 */
        if (context.allyMore) parts.push('allyMore');     // 友方人多
        if (context.enemyMore) parts.push('enemyMore');   // 敌方人多
        if (context.equal) parts.push('equal');         // 人数相等

        /* ㊸ 关键牌在手 */
        if (context.myHasSha) parts.push('myHasSha');     // 我有杀
        if (context.myHasShan) parts.push('myHasShan');   // 我有闪
        if (context.myHasTao) parts.push('myHasTao');     // 我有桃
        if (context.myHasWuxie) parts.push('myHasWuxie'); // 我有无懈
        if (context.tgtHasSha) parts.push('tgtHasSha');   // 目标有杀
        if (context.tgtHasShan) parts.push('tgtHasShan'); // 目标有闪
        if (context.tgtHasTao) parts.push('tgtHasTao');   // 目标有桃
        if (context.tgtHasWuxie) parts.push('tgtHasWuxie'); // 目标有无懈

        /* ㊹ 出牌阶段进度 */
        if (context.playStart) parts.push('playStart');   // 出牌刚开始
        if (context.playMid) parts.push('playMid');       // 出牌中期
        if (context.playEnd) parts.push('playEnd');       // 出牌快结束

        /* ㊺ 弃牌阶段 */
        if (context.needDiscard) parts.push('needDiscard'); // 需要弃牌
        if (context.keepAll) parts.push('keepAll');       // 不需要弃牌

        /* ㊻ 之前被打 */
        if (context.beenAttackedLast) parts.push('beenAttackedLast'); // 上轮被打了
        if (context.beenAttackedRecent) parts.push('beenAttackedRecent'); // 近期被打了

        /* ㊼ 救过人 */
        if (context.savedAllyLast) parts.push('savedAllyLast'); // 上轮救过队友
        if (context.helpedAlly) parts.push('helpedAlly');   // 帮过队友

        /* ㊽ 打过谁 */
        if (context.attackedZhugin) parts.push('attackedZhugin'); // 打过主公
        if (context.attackedLowHp) parts.push('attackedLowHp'); // 打过残血
        if (context.attackedHighHp) parts.push('attackedHighHp'); // 打过满血

        /* ㊾ 手牌质量 */
        if (context.handGood) parts.push('handGood');     // 手牌质量好
        if (context.handBad) parts.push('handBad');       // 手牌质量差
        if (context.handMixed) parts.push('handMixed');   // 手牌质量一般

        /* ㊿ 综合局势 */
        if (context.winning) parts.push('winning');       // 我们在赢
        if (context.losing) parts.push('losing');         // 我们在输
        if (context.close) parts.push('close');           // 局势胶着

        return parts.sort().join('+');
    } catch (e) { return null; }
}

/* ================= 查询：这个场景是否是重要特征 ================= */
export function getAutoFeatureWeight(context) {
    try {
        _load();
        const key = _comboKey(context);
        if (!key || !STORE.combos[key]) return 0;

        const c = STORE.combos[key];
        if (c.count < 5) return 0;  // 样本太少不算

        /* 计算平均收益 */
        const avgReward = c.totalReward / c.count;
        const winRate = c.wins / c.count;

        /* 如果平均收益显著偏离 0，就给一个权重 */
        let weight = 0;
        if (avgReward > 5) weight = Math.min(2.0, avgReward / 10);   // 正收益 → 正权重
        if (avgReward < -5) weight = Math.max(-2.0, avgReward / 10);  // 负收益 → 负权重

        return weight;
    } catch (e) { return 0; }
}

/* ================= 统计接口 ================= */
export function autoFeatureStats() {
    try {
        _load();
        const combos = Object.keys(STORE.combos);
        let important = 0;
        combos.forEach(function (k) {
            const c = STORE.combos[k];
            if (c.count >= 5 && Math.abs(c.totalReward / c.count) > 5) {
                important++;
            }
        });
        return {
            totalCombos: combos.length,
            importantCombos: important,
        };
    } catch (e) { return { totalCombos: 0, importantCombos: 0 }; }
}

/* ================= 列出 Top 10 重要特征 ================= */
export function topAutoFeatures(n) {
    try {
        _load();
        const list = [];
        Object.keys(STORE.combos).forEach(function (k) {
            const c = STORE.combos[k];
            if (c.count >= 5) {
                list.push({
                    combo: k,
                    count: c.count,
                    avgReward: Math.round((c.totalReward / c.count) * 100) / 100,
                    winRate: Math.round((c.wins / c.count) * 100) / 100,
                });
            }
        });
        list.sort(function (a, b) {
            return Math.abs(b.avgReward) - Math.abs(a.avgReward);
        });
        return list.slice(0, n || 10);
    } catch (e) { return []; }
}

export function resetAutoFeatures() {
    STORE = { v: VERSION, combos: {} };
    try { localStorage.removeItem(STORE_KEY); } catch (e) {}
    log.info('autoFeature', '自动特征发现数据已复位');
}

/* ================= 挂载 ================= */
if (typeof window !== 'undefined') {
    window.__DJSC = window.__DJSC || {};
    window.__DJSC.autoFeature = {
        record: recordDecisionContext,
        settle: settleDecisionContext,
        weight: getAutoFeatureWeight,
        stats: autoFeatureStats,
        top: topAutoFeatures,
        reset: resetAutoFeatures,
    };
}
