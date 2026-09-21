/* ================= 决策积分引擎 · 训练数据导出 =================
 * 作用：缓冲每局的训练样本，游戏结束后导出为 JSON
 * 数据格式：
 *   {
 *     version: "1.0",
 *     mode: "identity",
 *     startTime: timestamp,
 *     endTime: timestamp,
 *     samples: [
 *       [f0, f1, ..., f31, reward],
 *       ...
 *     ]
 *   }
 */
import { FEATURE_DIM, extractFeatures } from './features.js';

/* ★ 样本缓冲区 */
const SAMPLE_BUFFER = [];

/* ★ 当前局信息 */
let _currentGame = {
    mode: '',
    startTime: 0,
    samples: [],
    meId: '',
};

/* ★ 开始一局 */
export function trainStartGame(me, mode) {
    try {
        _currentGame = {
            mode: mode || 'unknown',
            startTime: Date.now(),
            samples: [],
            meId: me ? (me.playerid || me.id) : '',
        };
    } catch (e) {}
}

/* ★ 记录一条样本（决策点） */
export function trainRecordSample(me, act, ctx, score) {
    try {
        if (!me || !act) return;

        /* 提取特征 */
        const f = extractFeatures(me, act, ctx);

        /* 构造样本：[特征..., reward=0 占位] */
        const sample = new Array(FEATURE_DIM + 1);
        for (let i = 0; i < FEATURE_DIM; i++) sample[i] = f[i];
        sample[FEATURE_DIM] = 0;  /* reward 占位，结束时回填 */

        _currentGame.samples.push(sample);
    } catch (e) {}
}

/* ★ 结束一局，回填 reward */
export function trainSettleGame(reward, result) {
    try {
        if (!_currentGame.samples.length) return;

        /* 回填 reward 到所有样本 */
        _currentGame.samples.forEach(function (s) {
            s[FEATURE_DIM] = reward;
        });

        /* 加入总缓冲区 */
        SAMPLE_BUFFER.push({
            version: '1.0',
            mode: _currentGame.mode,
            startTime: _currentGame.startTime,
            endTime: Date.now(),
            result: result || '',
            samples: _currentGame.samples,
        });

        /* 清空当前局 */
        _currentGame.samples = [];

        console.log('[DJSC·训练] 样本已保存，本局', _currentGame.samples.length, '条，累计', SAMPLE_BUFFER.length, '局');
    } catch (e) {}
}

/* ★ 导出为 JSON */
export function trainExportJSON() {
    try {
        const allSamples = [];
        let totalCount = 0;

        SAMPLE_BUFFER.forEach(function (game) {
            game.samples.forEach(function (s) {
                allSamples.push(Array.from(s));
                totalCount++;
            });
        });

        return {
            version: '1.0',
            exportTime: Date.now(),
            gameCount: SAMPLE_BUFFER.length,
            count: totalCount,
            featureDim: FEATURE_DIM,
            samples: allSamples,
        };
    } catch (e) {
        return { error: String(e) };
    }
}

/* ★ 导出并下载 */
export function trainExportAndDownload() {
    try {
        const data = trainExportJSON();
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'djsc_training_' + Date.now() + '.json';
        a.click();
        URL.revokeObjectURL(url);
        return { ok: true, count: data.count, gameCount: data.gameCount };
    } catch (e) {
        return { ok: false, err: String(e) };
    }
}

/* ★ 清空缓冲区 */
export function trainClearBuffer() {
    try {
        SAMPLE_BUFFER.length = 0;
        _currentGame.samples = [];
        return { ok: true };
    } catch (e) {
        return { ok: false, err: String(e) };
    }
}

/* ★ 获取统计 */
export function trainStats() {
    try {
        let total = 0;
        SAMPLE_BUFFER.forEach(function (g) { total += g.samples.length; });
        return {
            games: SAMPLE_BUFFER.length,
            samples: total,
        };
    } catch (e) {
        return { games: 0, samples: 0 };
    }
}
