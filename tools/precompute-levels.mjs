// Regenerates src/game/level-data.js from scratch. Not used at runtime —
// this is the offline generator + solver-verifier described in the README.
// Run with: node tools/precompute-levels.mjs
import { LiquidPuzzle } from '../src/game/engine.js';
import { mulberry32 } from '../src/core/utils.js';
import { writeFileSync } from 'fs';

// ---- Binary min-heap ----------------------------------------------------
class Heap {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(item, score) {
    this.a.push({ item, score });
    let i = this.a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.a[p].score <= this.a[i].score) break;
      [this.a[p], this.a[i]] = [this.a[i], this.a[p]];
      i = p;
    }
  }
  pop() {
    const top = this.a[0];
    const last = this.a.pop();
    if (this.a.length) {
      this.a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = 2 * i + 2;
        let s = i;
        if (l < this.a.length && this.a[l].score < this.a[s].score) s = l;
        if (r < this.a.length && this.a[r].score < this.a[s].score) s = r;
        if (s === i) break;
        [this.a[s], this.a[i]] = [this.a[i], this.a[s]];
        i = s;
      }
    }
    return top.item;
  }
}

function runsInContainer(c) {
  if (!c.length) return 0;
  let runs = 1;
  for (let i = 1; i < c.length; i++) if (c[i] !== c[i - 1]) runs++;
  return runs;
}

function heuristic(p) {
  let h = 0;
  for (const c of p.containers) h += Math.max(0, runsInContainer(c) - 1) * 2;
  const colorContainers = new Map();
  for (let i = 0; i < p.containers.length; i++) {
    for (const col of new Set(p.containers[i])) {
      if (!colorContainers.has(col)) colorContainers.set(col, new Set());
      colorContainers.get(col).add(i);
    }
  }
  for (const set of colorContainers.values()) h += Math.max(0, set.size - 1);
  return h;
}

function stateKey(containers) { return containers.map((c) => c.join('')).join('|'); }

function solve(puzzle, nodeBudget) {
  const startKey = stateKey(puzzle.containers);
  const heap = new Heap();
  heap.push({ p: puzzle, g: 0, key: startKey }, heuristic(puzzle));
  const bestG = new Map([[startKey, 0]]);
  let nodes = 0;
  while (heap.size && nodes < nodeBudget) {
    const cur = heap.pop();
    nodes++;
    if (cur.p.isSolved()) return { moves: cur.g, nodes };
    if ((bestG.get(cur.key) ?? Infinity) < cur.g) continue;
    const moves = cur.p.legalMoves();
    for (const [from, to] of moves) {
      const next = cur.p.clone();
      next.pour(from, to);
      const key = stateKey(next.containers);
      const g = cur.g + 1;
      if (g < (bestG.get(key) ?? Infinity)) {
        bestG.set(key, g);
        const score = g + heuristic(next) * 1.6; // weighted A*, favors speed over optimality
        heap.push({ p: next, g, key }, score);
      }
    }
  }
  return null;
}

function dealBag(colorsCount, emptyContainers, capacity, rng) {
  const bag = [];
  for (let c = 0; c < colorsCount; c++) for (let k = 0; k < capacity; k++) bag.push(c);
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  const containers = [];
  let idx = 0;
  for (let c = 0; c < colorsCount; c++) { containers.push(bag.slice(idx, idx + capacity)); idx += capacity; }
  for (let e = 0; e < emptyContainers; e++) containers.push([]);
  // Retry the deal if, by chance, a container already came out monochrome-complete
  // (rare, but makes for a boring "already partly solved" opener).
  for (let c = 0; c < colorsCount; c++) {
    const cont = containers[c];
    if (cont.every((v) => v === cont[0])) return null;
  }
  // shuffle container order
  for (let i = containers.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [containers[i], containers[j]] = [containers[j], containers[i]];
  }
  return containers;
}

function difficultyFor(worldIndex, levelIndex) {
  const base = 3 + Math.floor(worldIndex * 0.8);
  const colorsCount = Math.min(9, base + Math.floor(levelIndex / 2));
  const emptyContainers = levelIndex >= 5 ? 3 : (levelIndex >= 2 ? 2 : 2);
  const capacity = worldIndex >= 4 && levelIndex >= 6 ? 5 : 4;
  return { colorsCount, emptyContainers, capacity };
}

function generateVerified(worldIndex, levelIndex, baseSeed) {
  const { colorsCount, emptyContainers, capacity } = difficultyFor(worldIndex, levelIndex);
  for (let attempt = 0; attempt < 400; attempt++) {
    const seed = baseSeed + attempt * 7919;
    const rng = mulberry32(seed);
    const containers = dealBag(colorsCount, emptyContainers, capacity, rng);
    if (!containers) continue;
    const puzzle = new LiquidPuzzle({ containers, capacity, colorsCount });
    const budget = 60000 + colorsCount * 20000;
    const result = solve(puzzle, budget);
    if (result) {
      return { containers, capacity, colorsCount, parMoves: result.moves, seed, attempt, nodes: result.nodes };
    }
  }
  throw new Error(`No solvable deal found for world ${worldIndex} level ${levelIndex}`);
}

const WORLD_IDS = ['candy', 'neon', 'space', 'jungle', 'endgame'];
const LEVELS_PER_WORLD = 8;
const out = {};
for (let w = 0; w < WORLD_IDS.length; w++) {
  for (let l = 0; l < LEVELS_PER_WORLD; l++) {
    const baseSeed = (w + 1) * 100000 + (l + 1) * 37 + 9001;
    const t0 = Date.now();
    const lvl = generateVerified(w, l, baseSeed);
    const ms = Date.now() - t0;
    out[`${WORLD_IDS[w]}-${l + 1}`] = { containers: lvl.containers, capacity: lvl.capacity, colorsCount: lvl.colorsCount, parMoves: lvl.parMoves };
    console.log(`${WORLD_IDS[w]} L${l + 1}: colors=${lvl.colorsCount} containers=${lvl.containers.length} cap=${lvl.capacity} par=${lvl.parMoves} attempt=${lvl.attempt} nodes=${lvl.nodes} time=${ms}ms`);
  }
}

const banner = '// Generated by tools/precompute-levels.mjs — do not hand-edit.\n';
writeFileSync('./src/game/level-data.js', `${banner}export const LEVEL_DATA = ${JSON.stringify(out)};\n`);
console.log('\nWrote src/game/level-data.js');
