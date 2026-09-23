/* ================= 决策积分引擎 · 对手长期记忆 =================
 * 跨局记住每个玩家（按 nickname/uid 识别）：
 *   ① 身份偏好：常选什么身份、胜率如何
 *   ② 行为画像：激进/保守/爱救人/爱盲杀
 *   ③ 仇恨度：攻击过我多少次
 *   ④ 常用套路：爱留桃、爱憋无懈、爱抢地主
 */
import { lib, game, get, _status } from '../../../../../noname.js';
import { cfg } from '../misc/util.js';
import { log } from '../misc/logger.js';

const STORE_KEY = 'djsc_player_memory_v1';
const VERSION = 1;
const MAX_PLAYERS = 100;

let STORE = { v: VERSION, players: {} };
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
        /* 保留最近活跃的 MAX_PLAYERS 个 */
        const keys = Object.keys(STORE.players);
        if (keys.length > MAX_PLAYERS) {
            keys.sort(function (a, b) {
                return (STORE.players[a].lastSeen || 0) - (STORE.players[b].lastSeen || 0);
            });
            for (let i = 0; i < keys.length - MAX_PLAYERS; i++) {
                delete STORE.players[keys[i]];
            }
        }
        localStorage.setItem(STORE_KEY, JSON.stringify(STORE));
    } catch (e) {}
}

/* ================= 玩家唯一键 ================= */
function _keyOf(p) {
    try {
        if (!p) return null;
        return p.nickname || p.uid || p.name1 || p.name || null;
    } catch (e) { return null; }
}

/* ================= 新玩家初始化 ================= */
function _ensurePlayer(key) {
    if (!STORE.players[key]) {
        STORE.players[key] = {
            key: key,
            firstSeen: Date.now(),
            lastSeen: Date.now(),
            games: 0,
            wins: 0,
            /* 身份计数 */
            identities: { zhu: 0, zhong: 0, fan: 0, nei: 0 },
            /* 行为画像 */
            aggression: 0.5,      /* 0~1，越大越激进 */
            survival: 0.5,        /* 0~1，越大越会保命 */
            teamwork: 0.5,        /* 0~1，越大越团队 */
            /* 攻击/救援我 */
            attackedMe: 0,
            aidedMe: 0,
            /* 常用套路 */
            habits: {
                keepsTao: 0,
                keepsWuxie: 0,
                keepsSha: 0,
                usesAoe: 0,
                usesSha: 0,
                usesTao: 0,
            },
            /* 平均结局 */
            avgScore: 0,
            /* ★ 身份暴露度（新增） */
            identityReveal: {
                fan: 0,      /* 有多少证据表明他是反贼 */
                zhong: 0,    /* 有多少证据表明他是忠臣 */
                nei: 0,      /* 有多少证据表明他是内奸 */
                zhu: 0,      /* 有多少证据表明他是主公 */
            },
            /* ★ 明置身份历史（新增）：阵亡后如果身份已明置，记录真实身份 */
            identityHistory: [],  /* [{round, identity, shown: true}] */
        };
    }
    STORE.players[key].lastSeen = Date.now();
    return STORE.players[key];
}

/* ================= 记录一局结果 ================= */
export function rememberGame(player, stats) {
    try {
        _load();
        const key = _keyOf(player);
        if (!key) return null;
        const p = _ensurePlayer(key);
        p.games++;
        if (stats && stats.win) p.wins++;
        /* 身份计数 */
        if (player.identity && p.identities[player.identity] !== undefined) {
            p.identities[player.identity]++;
        }
        /* ★ 阵亡后记录明置身份：如果身份已明置（identityShown），记录真实身份 */
        try {
            if (player.identityShown && player.identity) {
                p.identityHistory.push({
                    round: (_status && _status.roundNumber) || 0,
                    identity: player.identity,
                    ts: Date.now(),
                });
                /* 只保留最近20条 */
                if (p.identityHistory.length > 20) {
                    p.identityHistory = p.identityHistory.slice(-20);
                }
            }
        } catch (e) {}
        /* 平均分 */
        if (stats && typeof stats.score === 'number') {
            const prev = p.games - 1;
            p.avgScore = prev > 0
                ? (p.avgScore * prev + stats.score) / p.games
                : stats.score;
        }
        /* 行为画像更新（移动平均） */
        if (stats && stats.aggression !== undefined) {
            p.aggression = p.aggression * 0.8 + stats.aggression * 0.2;
        }
        if (stats && stats.survival !== undefined) {
            p.survival = p.survival * 0.8 + stats.survival * 0.2;
        }
        if (stats && stats.teamwork !== undefined) {
            p.teamwork = p.teamwork * 0.8 + stats.teamwork * 0.2;
        }
        /* 习惯累积 */
        if (stats && stats.habits) {
            Object.keys(stats.habits).forEach(function (k) {
                if (p.habits[k] !== undefined) p.habits[k] += stats.habits[k];
            });
        }
        _save();
        return p;
    } catch (e) { return null; }
}

/* ================= 记录攻击/救援 ================= */
export function rememberAttack(attacker, target) {
    try {
        _load();
        const key = _keyOf(attacker);
        if (!key) return;
        const p = _ensurePlayer(key);
        /* 目标是 AI 自己（game.me）→ 记录"攻击过我" */
        if (target === game.me) {
            p.attackedMe++;
            /* ★ 身份暴露度：攻击我 → 更可能是反贼 */
            if (p.identityReveal) {
                p.identityReveal.fan += 1;  /* 攻击我，反贼证据+1 */
                p.identityReveal.zhong -= 0.5; /* 忠臣不会打我，证据-0.5 */
            }
        }
        _save();
    } catch (e) {}
}
export function rememberAid(helper, target) {
    try {
        _load();
        const key = _keyOf(helper);
        if (!key) return;
        const p = _ensurePlayer(key);
        if (target === game.me) {
            p.aidedMe++;
            /* ★ 身份暴露度：救我 → 更可能是忠臣 */
            if (p.identityReveal) {
                p.identityReveal.zhong += 1;  /* 救我，忠臣证据+1 */
                p.identityReveal.fan -= 0.5;  /* 反贼不会救我，证据-0.5 */
            }
        }
        _save();
    } catch (e) {}
}

/* ================= 读取画像 ================= */
export function recallPlayer(player) {
    try {
        _load();
        const key = _keyOf(player);
        if (!key) return null;
        return STORE.players[key] || null;
    } catch (e) { return null; }
}

/* ================= 仇恨度（0~1） ================= */
export function hostilityLevel(player) {
    try {
        const p = recallPlayer(player);
        if (!p) return 0;
        const net = p.attackedMe - p.aidedMe;
        if (net <= 0) return 0;
        /* 1 次攻击 → 0.15，5 次 → 0.75，10 次 → 上限 1 */
        return Math.min(1, net / 10);
    } catch (e) { return 0; }
}

/* ================= 应用层：记忆加成 ================= */
export function playerMemoryBonus(me, target, action) {
    try {
        if (cfg('playerMemory', true) === false) return 1.0;
        if (!me || !target || !action) return 1.0;

        const p = recallPlayer(target);
        if (!p || p.games < 2) return 1.0;   /* 记忆不足 → 不加成 */

        let bonus = 1.0;

        /* ① 仇恨度：常攻击我 → 攻击他时加成 */
        const hostility = hostilityLevel(target);
        if (hostility > 0.3) {
            if (['sha', 'juedou', 'huogong', 'nanman', 'wanjian', 'shunshou', 'guohe', 'lebu', 'bingliang'].indexOf(action.id) >= 0) {
                bonus *= (1 + hostility * 0.3);
            }
        }

        /* ② 激进对手 → 优先压制（先手减少威胁） */
        if (p.aggression > 0.65 && ['sha', 'juedou', 'huogong'].indexOf(action.id) >= 0) {
            bonus *= 1.15;
        }

        /* ③ 保守对手 → 优先拆关键牌（破他节奏） */
        if (p.aggression < 0.35 && ['guohe', 'shunshou', 'lebu', 'bingliang'].indexOf(action.id) >= 0) {
            bonus *= 1.15;
        }

        /* ④ 团队型对手 → 优先拆他装备（破团队支援） */
        if (p.teamwork > 0.65 && ['guohe', 'shunshou'].indexOf(action.id) >= 0) {
            bonus *= 1.1;
        }

        /* ⑤ 有留桃习惯 → 攻击他时降低"能击杀"的期望 */
        if (p.habits.keepsTao >= 3 && ['sha', 'juedou', 'huogong'].indexOf(action.id) >= 0) {
            bonus *= 0.92;
        }

        return Math.round(bonus * 1000) / 1000;
    } catch (e) { return 1.0; }
}

/* ================= 查询接口 ================= */
export function playerMemoryStats() {
    _load();
    const keys = Object.keys(STORE.players);
    let totalGames = 0, withAttack = 0;
    keys.forEach(function (k) {
        totalGames += STORE.players[k].games;
        if (STORE.players[k].attackedMe > 0) withAttack++;
    });
    return {
        players: keys.length,
        totalGames: totalGames,
        playersWithAttackHistory: withAttack,
    };
}

export function playerMemoryList(n) {
    _load();
    const out = [];
    Object.keys(STORE.players).forEach(function (k) {
        const p = STORE.players[k];
        out.push({
            key: k,
            games: p.games,
            wins: p.wins,
            winRate: p.games > 0 ? Math.round(p.wins / p.games * 100) / 100 : 0,
            aggression: Math.round(p.aggression * 100) / 100,
            teamwork: Math.round(p.teamwork * 100) / 100,
            attackedMe: p.attackedMe,
            aidedMe: p.aidedMe,
            hostility: hostilityLevel(k),
        });
    });
    out.sort(function (a, b) { return b.games - a.games; });
    return out.slice(0, n || 20);
}

export function resetPlayerMemory() {
    STORE = { v: VERSION, players: {} };
    try { localStorage.removeItem(STORE_KEY); } catch (e) {}
    log.info('playerMemory', '玩家长期记忆已复位');
}

/* ================= 挂载（已移至 engine.js，避免重复） ================= */
_load();
