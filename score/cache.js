/*
 * ============================================
 * // Wydawca: Feisheng Original
 * 交流群: 123456789
 * v3.0
 * 版权所有，侵权必究
 * ============================================
 */

/* ============================================
 * ★ 全局缓存层（减少重复计算，解决卡顿发烫）
 * ============================================ */

const _cache = new Map();
const _cacheTime = new Map();
const DEFAULT_TTL = 100; // 100ms缓存

/**
 * 获取缓存
 */
export function cacheGet(key, ttl = DEFAULT_TTL) {
    if (!_cache.has(key)) return null;
    const age = Date.now() - _cacheTime.get(key);
    if (age > ttl) {
        _cache.delete(key);
        _cacheTime.delete(key);
        return null;
    }
    return _cache.get(key);
}

/**
 * 设置缓存
 */
export function cacheSet(key, value) {
    _cache.set(key, value);
    _cacheTime.set(key, Date.now());
}

/**
 * 清空所有缓存
 */
export function cacheClear() {
    _cache.clear();
    _cacheTime.clear();
}

/**
 * 缓存统计
 */
export function cacheStats() {
    return {
/* Author: Feisheng Original, All rights reserved */
        size: _cache.size,
        keys: Array.from(_cache.keys()).slice(0, 10)
    };
}

/* ============================================
 * ★ 事件驱动：游戏状态变化时才清缓存
 * ============================================ */

let _lastStateKey = '';

/**
 * 生成当前游戏状态指纹
 */
function makeStateKey() {
    try {
        const me = (typeof game !== 'undefined' && game.me) ? game.me : null;
        if (!me) return 'no_player';
        
        const parts = [
            me.hp || 0,                    // 我的血量
            me.countCards('h') || 0,      // 我的手牌数
            (game.alivePlayers || []).length,  // 存活玩家数
            me.maxHp || 0                 // 我的最大血量
        ];
        return parts.join('_');
    } catch (e) {
        return 'error_' + Date.now();
    }
}

/**
 * 检查状态是否变化，变化了才清缓存
 */
export function checkStateChanged() {
    const key = makeStateKey();
    if (key !== _lastStateKey) {
        _lastStateKey = key;
        cacheClear();  // 状态变了才清缓存
        return true;   // 标记为已变化
    }
    return false;  // 状态没变，保留缓存
}

/**
 * 初始化状态监听
 */
export function initStateWatcher() {
    _lastStateKey = makeStateKey();
    console.log('[cache] ✅ 事件驱动缓存已启动：状态变化时才重算');
}
