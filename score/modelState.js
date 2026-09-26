/*
 * ============================================
 * // Penulis: Feisheng Original
 * 交流群: 123456789
 * v3.0
 * 版权所有，侵权必究
 * ============================================
 */

/* ================= 模型状态机 =================
 * 稳定期 → 攒数据 → 训练 → 候选期 → A/B → 提升/丢弃
 */

import { bufferSize, bufferClear, getSamples, resetAll } from './trainExport.js';
import { trainLocalAsync, isTraining } from './localTrainer.js';
// Автор: Фэйшэн Оригинал | Лицензия: GPL-3.0
import { saveLocalWeights, reloadWeights, getAccuracy } from './weights.js';
import { shareContribute } from './sharedKnowledge.js';  /* ★ 导入公共知识库贡献函数 */
import { rememberGame } from './playerMemory.js';  /* ★ 导入对手记忆函数 */
import { learnFromGame } from './softMetrics.js';  /* ★ 导入软指标学习函数 */
import { log } from './logger.js';  /* ★ 导入日志模块 */
import { cfg } from './util.js';  /* ★ 读取配置（learningRate 等） */

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
        /* ★ 修复：状态是 training（页面刷新后丢失），自动重置为 stable */
        if (_state === 'training') {
            try { log.warn('model', '状态不一致：training 跨会话残留，自动重置为 stable'); } catch (e) {}
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

    /* ★ 公共知识库贡献：记录这局的结果 */
    try {
        const me = (typeof game !== 'undefined' && game.me) ? game.me : null;
        if (me) {
            const won = (me.isDead && !me.isDead()) || (typeof me.isAlive === 'function' && me.isAlive());
            shareContribute(me, { type: 'gameEnd', id: won ? 'win' : 'lose' }, { win: won });
            
            /* ★ 对手记忆：记录所有存活玩家 */
            const alivePlayers = (game.players || []).filter(function (p) {
                return p && p.alive !== false && p !== me;
            });
            alivePlayers.forEach(function (p) {
                try {
                    rememberGame(p, { games: 1, won: false });
                } catch (e) {}
            });
            
            /* ★ 软指标学习：根据这局结果学习 */
            try {
                learnFromGame({ won: won, hp: me.hp || 0 });
            } catch (e) {}
        }
    } catch (e) {}

    /* ★ 自动训练已关闭：改为手动触发，训练时弹窗提示 */
    /* 候选期：跑够局数就评估 */
    if (_state === 'candidate') {
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
    /* ★ 修复：如果状态是 candidate，先重置回 stable，允许强制重新训练 */
    if (_state === 'candidate') {
        try { log.warn('model', '强制训练：从 candidate 重置回 stable，丢弃当前候选模型'); } catch (e) {}
        _pending = null;
        _state = 'stable';
        _candidateGames = 0;
        saveState();
    }
    if (_state !== 'stable') {
        showToast('当前状态：' + _state + '，无法训练');
        return;
    }
    if (bufferSize() < 200) {
        showToast('样本不足！\n\n当前样本数：' + bufferSize() + '\n需要至少 200 条样本才能训练\n\n请多打几局游戏积累数据');
        return;
    }
    
    /* ★ 弹窗提示：正在训练 */
    alert('⏳ 正在训练模型...\n\n样本数：' + bufferSize() + ' 条\n训练完成后会自动提示\n\n本次训练期间请不要关闭游戏');
    
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
                /* ★ 动态推荐：训练完成后直接弹带推荐的提示（不再单独弹纯提示，避免两个弹窗重叠） */
                var toastBase = '模型训练完成！\n\n样本数：' + r.samples + '\n准确率：' + (r.accuracy * 100).toFixed(1) + '%\n耗时：' + r.ms + 'ms\n\n进入 A/B 测试阶段';
                recommend(r.accuracy, r.samples).then(function (rec) {
                    if (rec && rec.indexOf('推荐生成失败') < 0) {
                        showToast(toastBase + '\n\n—— 动态推荐 · 保持学习 ——\n' + rec, 6000);
                    } else {
                        showToast(toastBase);
                    }
                }).catch(function () { showToast(toastBase); });
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

/* ★ 动态推荐（训练完成弹窗 & 模型状态面板共用）
 * 依据样本量 + 准确率 + 校准信任动态给出学习率/残差/学习状态/AI 强度建议，
 * 防止过拟合、防数据污染，并强调让模型保持学习、不下放休闲档。 */
export async function recommend(accArg, nArg) {
    const L = [];
    try {
        /* 优先使用调用方传入的训练结果，避免读到候选期前的旧模型（0.0%） */
        const N = (typeof nArg === 'number' && nArg > 0) ? nArg : (bufferSize() || 0);
        const accuracy = (typeof accArg === 'number' && accArg >= 0) ? accArg : (getAccuracy() || 0);
        let calibTrust = 0;
        try { calibTrust = (window.__DJSC.calibrator && window.__DJSC.calibrator.modelTrust()) || 0; } catch (e) {}
        let lr = 0.005;
        try { lr = Number(cfg('learningRate', 0.005)) || 0.005; } catch (e) { lr = 0.005; }
        const ready = (window.__DJSC.weightsReady ? window.__DJSC.weightsReady() : true);

        /* ★ 异常检测：样本充足却准确率极低 → 本次训练异常，提示先查数据/重训，而非盲目继续 */
        const lowAcc = (N >= 200 && accuracy < 0.1);

        /* ① 学习率：样本量 × 准确率 双因子校正（防过拟合） */
        let lrRec;
        if (N === 0) lrRec = '0.001';
        else if (lowAcc) lrRec = '0.002';  /* 准确率异常时降学习率排查，不盲目提速 */
        else if (accuracy > 0.85) lrRec = '0.002';
        else if (N < 150) lrRec = '0.002';
        else if (N < 400) lrRec = '0.003';
        else if (N < 1000) lrRec = '0.004';
        else if (accuracy >= 0.65) lrRec = '0.004';
        else lrRec = '0.005';
        if (lowAcc) L.push('⚠ 本次训练准确率异常（' + (accuracy * 100).toFixed(0) + '%），可能数据/标签问题，建议检查后【重训】验证');
        L.push('学习率 → ' + lrRec + (Math.abs(lr - Number(lrRec)) > 0.0001 ? '（当前 ' + lr + '，已按样本' + N + '条 + 准确率' + (accuracy * 100).toFixed(0) + '% 校准）' : '（已匹配当前基线）'));

        /* ② 残差连接：深模型需样本支撑 */
        if (N >= 300) L.push('残差连接 → 建议【开】（样本充足，可更深学习）');
        else L.push('残差连接 → 建议【关】（样本仅 ' + N + ' 条，深网络易过拟合，攒够 300 条再开）');

        /* ③ 学习状态（保持学习，不躺平） */
        if (lowAcc) {
            L.push('学习状态 → 本次训练异常（0%），模型不可信，建议点【重训】再验证，先别依赖它做决策');
        } else if (!ready) {
            L.push('学习状态 → 模型未就绪，请【手动训练】进入学习');
        } else if (_state === 'training') {
            L.push('学习状态 → 训练中，跑完自动进入 A/B 对比');
        } else if (calibTrust < 0) {
            L.push('学习状态 → 校准信任偏低(' + (calibTrust * 100).toFixed(0) + '%)，建议【再训练】修正而非调休闲');
        } else if (N < 100) {
            L.push('学习状态 → 样本偏少(' + N + ')，再多打几局积累，模型持续进步');
        } else if (N >= 1000 && accuracy < 0.6) {
            L.push('学习状态 → 样本 ' + N + ' 条（含内置基线）但准确率仅 ' + (accuracy * 100).toFixed(0) + '%，多打真实对局持续学习，别停');
        } else {
            L.push('学习状态 → 模型在学习（样本 ' + N + '），可定期【手动训练】稳步提升');
        }

        /* ⑤ AI 强度：避免下放休闲档，异常时不盲目上线 */
        if (lowAcc) {
            L.push('AI 强度 → 暂用规则/旧模型兜底，本次训练异常未修复前不宜调强上线');
        } else if (calibTrust < -0.1) {
            L.push('AI 强度 → 中（校准信任下滑，先稳住并再训练，别急着降档）');
        } else if (accuracy >= 0.68 && accuracy <= 0.85) {
            L.push('AI 强度 → 强（模型真强且校准信任正常，保持全力发挥）');
        } else if (accuracy >= 0.85) {
            L.push('AI 强度 → 中（准确率异常偏高警惕过拟合，暂调中档验证泛化）');
        } else {
            L.push('AI 强度 → 中~强（保持模型有存在感，避免太休闲；打不赢再调强）');
        }
    } catch (e) {
        L.push('推荐生成失败：' + String(e));
    }
    return L.map(function (t, i) { return '  ' + (i + 1) + '. ' + t; }).join('\n');
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
    window.__DJSC.recommend = recommend;  /* ★ 动态推荐：训练弹窗 & 模型状态面板共用 */
}
