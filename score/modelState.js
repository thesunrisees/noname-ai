/* ================= 模型状态机 =================
 * 稳定期 → 攒数据 → 训练 → 候选期 → A/B → 提升/丢弃
 */

import { bufferSize, bufferClear, getSamples, resetAll } from './trainExport.js';
import { trainLocalAsync, isTraining } from './localTrainer.js';
import { saveLocalWeights, reloadWeights, getAccuracy } from './weights.js';

/* ★ 自定义浮层提示（训练完成后才消失） */
function showToast(msg, duration) {
    try {
        duration = duration || 3000;
        let toast = document.getElementById('djsc_toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'djsc_toast';
            toast.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.85);color:#fff;padding:20px 30px;border-radius:10px;z-index:99999;font-size:16px;line-height:1.6;max-width:80%;text-align:center;box-shadow:0 4px 20px rgba(0,0,0,0.5);';
            document.body.appendChild(toast);
        }
        toast.textContent = msg;
        toast.style.display = 'block';
        clearTimeout(toast._timer);
        toast._timer = setTimeout(function () {
            toast.style.display = 'none';
        }, duration);
    } catch (e) {
        alert(msg);
    }
}

/* ★ 训练中浮层（不自动消失，训练完成后手动替换） */
function showLoading(msg) {
    try {
        let toast = document.getElementById('djsc_toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'djsc_toast';
            toast.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.85);color:#fff;padding:20px 30px;border-radius:10px;z-index:99999;font-size:16px;line-height:1.6;max-width:80%;text-align:center;box-shadow:0 4px 20px rgba(0,0,0,0.5);';
            document.body.appendChild(toast);
        }
        toast.textContent = msg;
        toast.style.display = 'block';
        clearTimeout(toast._timer);
    } catch (e) {}
}

const STORAGE_KEY = 'djsc_model_state';

let _state = 'stable';          // stable / training / candidate
let _gamesSince = 0;            // 稳定期累计局数
let _candidateGames = 0;        // 候选期累计局数
let _pending = null;            // 待评估的新权重
let _abBaseline = [];           // 旧模型平均分（前 20 局）

/* 初始化：读取 localStorage */
(function loadState() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const obj = JSON.parse(raw);
            if (obj && typeof obj.state === 'string') _state = obj.state;
            if (obj && typeof obj.gamesSince === 'number') _gamesSince = obj.gamesSince;
        }
        /* ★ 修复：状态是 candidate 但没有 _pending（页面刷新后丢失），自动重置为 stable */
        if (_state === 'candidate' && !_pending) {
            try { log.warn('model', '状态不一致：candidate 但无候选，自动重置为 stable'); } catch (e) {}
            _state = 'stable';
            _gamesSince = 0;
            saveState();
        }
    } catch (e) {}
})();

function saveState() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            state: _state,
            gamesSince: _gamesSince,
            candidateGames: _candidateGames,
            ts: Date.now(),
        }));
    } catch (e) {}
}

export function getState() { return _state; }
export function getGamesSince() { return _gamesSince; }

/* ================= 每局结束调用 ================= */
export function onGameEnd() {
    _gamesSince++;

    /* 稳定期：攒够样本就训练 */
    if (_state === 'stable') {
        const threshold = _getThreshold();
        if (bufferSize() >= threshold) {
            _state = 'training';
            saveState();
            try { log.info('model', '样本 ' + bufferSize() + ' 条 ≥ ' + threshold + '，开始训练'); } catch (e) {}
            setTimeout(() => {
                trainLocalAsync(function (r) {
                    if (r && r.ok) {
                        _pending = r;
                        _state = 'candidate';
                        _candidateGames = 0;
                        /* 记录当前基线（用旧模型跑 20 局的均值） */
                        _abBaseline = _loadABHistory();
                        saveState();
                        try { log.info('model', '训练完成 accuracy=' + r.accuracy + '，进入 A/B 测试'); } catch (e) {}
                        showToast('模型训练完成！\n样本数：' + r.samples + '\n准确率：' + (r.accuracy * 100).toFixed(1) + '%\n耗时：' + r.ms + 'ms\n\n进入 A/B 测试阶段');
                    } else {
                        _state = 'stable';
                        saveState();
                        try { log.warn('model', '训练失败：' + (r && r.err)); } catch (e) {}
                        showToast('模型训练失败：' + (r && r.err));
                    }
                });
            }, 3000);
        }
    }

    /* 候选期：跑够局数就评估 */
    else if (_state === 'candidate') {
        _candidateGames++;
        _gamesSince = _candidateGames;  /* ★ 让面板显示候选期局数 */
        saveState();
        if (_candidateGames >= _getCandidateGames()) {
            evaluateCandidate();
        }
    }
}

/* ================= 评估候选 ================= */
function evaluateCandidate() {
    try {
        const newAcc = _pending ? _pending.accuracy : 0;
        const oldAcc = getAccuracy();
        const threshold = _getPromoteThreshold();

        /* 简单策略：新模型准确率 > 旧模型 * (1 + 阈值) 才提升 */
        if (newAcc >= oldAcc * (1 + threshold) || oldAcc === 0) {
            promoteCandidate();
        } else {
            discardCandidate();
        }
    } catch (e) {
        discardCandidate();
    }
}

function promoteCandidate() {
    if (!_pending) return;
    try {
        saveLocalWeights(_pending.W, _pending.b, _pending.accuracy);
        reloadWeights();
        try { log.info('model', '候选提升成功，accuracy=' + _pending.accuracy); } catch (e) {}
        showToast('模型 A/B 测试通过！\n\n新模型准确率：' + (_pending.accuracy * 100).toFixed(1) + '%\n\n已自动提升为正式模型');
    } catch (e) {}
    _pending = null;
    _state = 'stable';
    _gamesSince = 0;
    saveState();
    /* 提升后清空样本，开始新一轮收集 */
    resetAll();
}

function discardCandidate() {
    try { log.info('model', '候选未通过，保留旧模型'); } catch (e) {}
    showToast('模型 A/B 测试未通过\n\n保留旧模型，继续积累数据');
    _pending = null;
    _state = 'stable';
    _gamesSince = 0;
    saveState();
    /* 不清样本，继续累积，下轮一起用 */
}

/* ================= 配置读取 ================= */
function _getThreshold() {
    try {
        const mode = (typeof cfg === 'function') ? cfg('modelUpdateMode', 'auto_slow') : 'auto_slow';
        if (mode === 'auto_fast') return 300;
        if (mode === 'auto_slow') return 1000;
        return 99999;
    } catch (e) { return 1000; }
}

function _getCandidateGames() {
    try { return (typeof cfg === 'function') ? (Number(cfg('modelCandidateGames', 20)) || 20) : 20; }
    catch (e) { return 20; }
}

function _getPromoteThreshold() {
    try { return ((typeof cfg === 'function') ? (Number(cfg('modelPromoteThreshold', 10)) || 10) : 10) / 100; }
    catch (e) { return 0.10; }
}

/* ================= A/B 历史 ================= */
function _loadABHistory() {
    try {
        const raw = localStorage.getItem('djsc_ab_scores');
        return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
}

export function recordABScore(score) {
    try {
        const arr = _loadABHistory();
        arr.push(score);
        while (arr.length > 100) arr.shift();
        localStorage.setItem('djsc_ab_scores', JSON.stringify(arr));
    } catch (e) {}
}

/* ================= 调试接口 ================= */
export function forceTrain() {
    if (_state !== 'stable') {
        showToast('当前状态：' + _state + '，无法训练');
        return;
    }
    if (bufferSize() < 200) {
        showToast('样本不足！\n\n当前样本数：' + bufferSize() + '\n需要至少 200 条样本才能训练\n\n请多打几局游戏积累数据');
        return;
    }
    _state = 'training';
    saveState();
    showLoading('开始训练...\n\n样本数：' + bufferSize());
    trainLocalAsync(r => {
        /* ★ 延迟 1 秒再显示结果，让用户能看清楚"开始训练" */
        setTimeout(function () {
            if (r.ok) {
                _pending = r;
                _state = 'candidate';
                _candidateGames = 0;
                saveState();
                showToast('模型训练完成！\n\n样本数：' + r.samples + '\n准确率：' + (r.accuracy * 100).toFixed(1) + '%\n耗时：' + r.ms + 'ms\n\n进入 A/B 测试阶段');
            } else {
                _state = 'stable';
                saveState();
                showToast('模型训练失败：' + (r && r.err));
            }
        }, 1000);
    });
}

export function forcePromote() {
    if (!_pending) {
        showToast('没有候选模型可提升\n\n当前状态：' + _state);
        return { ok: false, err: 'no pending' };
    }
    promoteCandidate();
    return { ok: true, msg: '提升成功' };
}

export function forceDiscard() {
    if (!_pending) {
        showToast('没有候选模型可丢弃\n\n当前状态：' + _state);
        return { ok: false, err: 'no pending' };
    }
    discardCandidate();
    return { ok: true, msg: '已丢弃' };
}

/* 挂到全局方便控制台调试 */
if (typeof window !== 'undefined') {
    window.__DJSC = window.__DJSC || {};
    window.__DJSC.modelState = {
        getState, getGamesSince,
        forceTrain, forcePromote, forceDiscard,
        onGameEnd,
    };
    window.__DJSC.forceTrain = forceTrain;
    window.__DJSC.forcePromote = forcePromote;
    window.__DJSC.forceDiscard = forceDiscard;
    window.__DJSC.getState = getState;
    window.__DJSC.getGamesSince = getGamesSince;
}
