/* ================= 决策积分引擎 · 蒸馏权重 =================
 * 作用：存放从 Python 训练得到的线性回归权重
 * 格式：WEIGHTS[i] 是第 i 个特征的权重
 *       BIAS 是截距
 *       WEIGHTS_READY = true 表示权重已就绪，可以启用
 *
 * ★ 更新方式：
 *   1. 从无名杀导出训练数据 JSON
 *   2. 电脑上跑 Python 脚本训练
 *   3. 把输出的 WEIGHTS 和 BIAS 粘贴到这里
 */

/* 特征维度（必须和 features.js 的 FEATURE_DIM 一致） */
export const FEATURE_DIM = 32;

/* ★ 默认权重（未训练时的初始值，全 0） */
export const WEIGHTS = new Float32Array(32);

/* ★ 默认偏置 */
export const BIAS = 0;

/* ★ 权重是否就绪（训练完改成 true） */
export const WEIGHTS_READY = false;

/* ★ 模型版本说明 */
export const MODEL_INFO = {
    version: '0.0.0',
    trainedAt: '',
    r2: 0,
    mae: 0,
    sampleCount: 0,
    gameCount: 0,
};

/* ★ 用模型预测分数 */
export function predictScore(features) {
    if (!WEIGHTS_READY) return 0;
    try {
        let s = BIAS;
        for (let i = 0; i < FEATURE_DIM && i < features.length; i++) {
            s += WEIGHTS[i] * features[i];
        }
        return s;
    } catch (e) {
        return 0;
    }
}
