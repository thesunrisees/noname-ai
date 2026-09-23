/* ================= 校验事件记录器 =================
 * 记录合法性校验事件（拦截/豁免）
 */

const STORAGE_KEY = 'djsc_guard_recorder';

let _events = [];
let _exported = 0;

try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
        const obj = JSON.parse(raw);
        if (obj && Array.isArray(obj.events)) _events = obj.events;
        if (obj && typeof obj.exported === 'number') _exported = obj.exported;
    }
} catch (e) {}

function _save() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            events: _events.slice(-100),
            exported: _exported,
        }));
    } catch (e) {}
}

/* 记录一次校验事件 */
export function recordGuardEvent(type, card, target, result) {
    try {
        _events.push({
            ts: Date.now(),
            type: type,
            card: card,
            target: target,
            result: result,
        });
        if (_events.length > 100) _events = _events.slice(-100);
        _save();
    } catch (e) {}
}

/* 获取统计 */
export function getGuardStats() {
    const blocked = _events.filter(e => e.result === 'blocked').length;
    const allowed = _events.filter(e => e.result === 'allowed').length;
    return {
        total: _events.length,
        blocked: blocked,
        allowed: allowed,
        exported: _exported,
        recent: _events.slice(-10),
    };
}

/* 重置 */
export function resetGuardRecorder() {
    _events = [];
    _save();
    return { ok: true };
}
