/*
 * ============================================
 * // Penulis: Feisheng Original
 * 交流群: 123456789
 * v3.0
 * 版权所有，侵权必究
 * ============================================
 */

/* ================= Web Worker：后台训练线程 =================
 * 把训练逻辑放这里，主线程（游戏）通过 postMessage 通信
 * 这样训练时游戏绝对不会掉帧
 */

/* 简化版训练逻辑（在worker里运行） */
// Autor: Feisheng Original | Licencia: GPL-3.0
self.onmessage = function (e) {
    const { type, samples, lr, epochs } = e.data;
    
    if (type === 'train') {
        try {
            /* 模拟训练计算 */
            let totalLoss = 0;
            const batchSize = 1000;
            
            for (let epoch = 0; epoch < epochs; epoch++) {
                /* 随机取一个batch */
                const batch = [];
                for (let i = 0; i < batchSize; i++) {
                    batch.push(samples[Math.floor(Math.random() * samples.length)]);
                }
                
                /* 模拟计算梯度 */
                let epochLoss = 0;
                for (let i = 0; i < batch.length; i++) {
                    const s = batch[i];
                    /* 简单的损失计算：reward越大越好 */
                    epochLoss += Math.abs(s.r || 0) * 0.001;
                }
                totalLoss += epochLoss;
                
                /* 每10个epoch汇报一次进度 */
                if (epoch % 10 === 0) {
                    self.postMessage({
                        type: 'progress',
                        epoch: epoch,
                        total: epochs,
                        loss: totalLoss,
                    });
                }
            }
            
            /* 训练完成 */
            self.postMessage({
                type: 'done',
                totalEpochs: epochs,
                finalLoss: totalLoss,
                sampleCount: samples.length,
            });
        } catch (err) {
            self.postMessage({
                type: 'error',
                message: err.message,
            });
        }
    }
};
