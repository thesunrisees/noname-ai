/* ================= 校验事件记录器 =================
 * 记录合法性校验事件（拦截/豁免）
 */

let _events = [];

function _save() {
    try {
        localStorage.setItem('djsc_guard_recorder', JSON.stringify({
            events: _events,
            exported: 0,
        }));
    } catch (e) {}
}

export function recordGuardEvent(event) {
    _events.push(event);
    _save();
    return { ok: true };
}

export function getGuardStats() {
    return {
        total: _events.length,
        blocked: 0,
        allowed: 0,
        exported: 0,
        recent: _events.slice(-10),
    };
}

export function resetGuardRecorder() {
    _events = [];
    _save();
    return { ok: true };
}
