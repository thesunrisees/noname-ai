/* ================= 决策积分引擎 · 策略进化 =================
 * 用遗传算法维护一个档案种群：
 *   ① 适应度 = 档案胜率
 *   ② 每 N 局执行一次：精英保留 / 杂交 / 变异 / 淘汰
 */
import { log } from '../core/logger.js';

const STORE_KEY = 'djsc_evolution_v1';
const VERSION = 1;
const POP_SIZE = 8;
const ELITE = 2;
const MUTATE_RATE = 0.15;
const MUTATE_RANGE = 0.08;
const EVOLVE_INTERVAL = 5;

let STORE = {
    v: VERSION,
    population: [],
    generation: 0,
    lastEvolveGame: 0,
    gamesSinceEvolve: 0,
};
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
    try { localStorage.setItem(STORE_KEY, JSON.stringify(STORE)); } catch (e) {}
}

function _initPopulation() {
    if (STORE.population.length > 0) return;
    for (let i = 0; i < POP_SIZE; i++) {
        STORE.population.push(_randomGenome('G' + STORE.generation + '_' + i));
    }
    _save();
}

function _randomGenome(id) {
    return {
        id: id,
        genome: {
            atk: (Math.random() * 0.6 - 0.3),
            def: (Math.random() * 0.6 - 0.3),
            wAtkCard: (Math.random() * 0.6 - 0.3),
            wDefCard: (Math.random() * 0.6 - 0.3),
            modelTrust: (Math.random() * 0.6 - 0.3),
        },
        fitness: 0,
        games: 0,
        wins: 0,
        createdAt: Date.now(),
    };
}

export function evolveRecordResult(genomeId, win) {
    try {
        _load();
        _initPopulation();
        const ind = STORE.population.find(function (p) { return p.id === genomeId; });
        if (!ind) return;
        ind.games++;
        if (win) ind.wins++;
        ind.fitness = ind.games > 0 ? ind.wins / ind.games : 0;

        STORE.gamesSinceEvolve++;
        if (STORE.gamesSinceEvolve >= EVOLVE_INTERVAL) {
            _evolve();
            STORE.gamesSinceEvolve = 0;
            STORE.generation++;
        }
        _save();
    } catch (e) {}
}

function _evolve() {
    try {
        const pop = STORE.population;
        if (pop.length < 4) return;

        pop.sort(function (a, b) { return b.fitness - a.fitness; });

        const elite = pop.slice(0, ELITE);

        const offspring = [];
        const topHalf = pop.slice(0, Math.floor(POP_SIZE * 0.5));
        while (offspring.length + elite.length < POP_SIZE) {
            const p1 = topHalf[Math.floor(Math.random() * topHalf.length)];
            const p2 = topHalf[Math.floor(Math.random() * topHalf.length)];
            const child = _crossover(p1, p2, offspring.length + ELITE);
            offspring.push(child);
        }

        offspring.forEach(function (ind) {
            if (Math.random() < MUTATE_RATE) _mutate(ind);
        });

        STORE.population = elite.concat(offspring);

        try {
            log.info('evolution', '第 ' + STORE.generation + ' 代进化完成，精英适应度 ' +
                     (elite[0] ? elite[0].fitness.toFixed(2) : '0'));
        } catch (e) {}
    } catch (e) {}
}

function _crossover(p1, p2, idx) {
    const child = {
        id: 'G' + (STORE.generation + 1) + '_' + idx,
        genome: {},
        fitness: 0,
        games: 0,
        wins: 0,
        createdAt: Date.now(),
    };
    Object.keys(p1.genome).forEach(function (k) {
        child.genome[k] = Math.random() < 0.5 ? p1.genome[k] : p2.genome[k];
    });
    return child;
}

function _mutate(ind) {
    Object.keys(ind.genome).forEach(function (k) {
        if (Math.random() < 0.5) {
            let v = ind.genome[k] + (Math.random() * 2 - 1) * MUTATE_RANGE;
            v = Math.max(-0.3, Math.min(0.3, v));
            ind.genome[k] = Math.round(v * 1000) / 1000;
        }
    });
}

export function evolveCurrentGenome() {
    _load();
    _initPopulation();
    let best = null, bestFit = -1;
    STORE.population.forEach(function (p) {
        if (p.fitness > bestFit) { bestFit = p.fitness; best = p; }
    });
    return best;
}

export function evolveStats() {
    _load();
    _initPopulation();
    return {
        generation: STORE.generation,
        popSize: STORE.population.length,
        gamesSinceEvolve: STORE.gamesSinceEvolve,
        population: STORE.population.map(function (p) {
            return {
                id: p.id,
                fitness: Math.round(p.fitness * 1000) / 1000,
                games: p.games,
                wins: p.wins,
                genome: Object.assign({}, p.genome),
            };
        }).sort(function (a, b) { return b.fitness - a.fitness; }),
    };
}

export function evolveForceEvolve() {
    _load();
    _evolve();
    STORE.gamesSinceEvolve = 0;
    STORE.generation++;
    _save();
}

export function resetEvolution() {
    STORE = { v: VERSION, population: [], generation: 0, lastEvolveGame: 0, gamesSinceEvolve: 0 };
    try { localStorage.removeItem(STORE_KEY); } catch (e) {}
    _initPopulation();
    log.info('evolution', '策略进化已复位');
}

if (typeof window !== 'undefined') {
    window.__DJSC = window.__DJSC || {};
    window.__DJSC.evolution = {
        record: evolveRecordResult,
        current: evolveCurrentGenome,
        stats: evolveStats,
        forceEvolve: evolveForceEvolve,
        reset: resetEvolution,
        POP_SIZE: POP_SIZE,
        EVOLVE_INTERVAL: EVOLVE_INTERVAL,
    };
}
_load();
