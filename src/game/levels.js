// World/level definitions. Layouts in LEVEL_DATA were generated offline by
// randomly dealing colors into containers and verifying solvability with a
// weighted-A* solver (see tools/precompute-levels.mjs) — baked here as
// static data so the shipped game needs zero runtime search, every level
// is guaranteed solvable, and the same level always looks the same.

import { LEVEL_DATA } from './level-data.js';

export const WORLDS = [
  {
    id: 'candy', name: 'Candy World', tagline: 'Bright & bouncy',
    bg: ['#ff9ecf', '#ff6fa5', '#ffd76f'],
    music: { root: 220, scale: [0, 2, 4, 7, 9], tempo: 128, wave: 'triangle', bass: 'sine' },
    palette: ['#ff5c8a', '#ffd23f', '#4dd6c4', '#7c6cff', '#ff8a3d', '#37d67a', '#ff6fd8', '#5cc9ff', '#ff4d4d'],
    shapes: ['candy', 'jelly'],
  },
  {
    id: 'neon', name: 'Neon World', tagline: 'Funky electric glow',
    bg: ['#1a0b3d', '#3d1a6b', '#ff2fb0'],
    music: { root: 196, scale: [0, 3, 5, 7, 10], tempo: 132, wave: 'sawtooth', bass: 'square' },
    palette: ['#ff2fd0', '#2ff7ff', '#c6ff2f', '#ff9d2f', '#7a2fff', '#2fffb0', '#ff2f5f', '#2f8bff', '#f7ff2f'],
    shapes: ['capsule', 'tube'],
  },
  {
    id: 'space', name: 'Space World', tagline: 'Dreamy zero-g fizz',
    bg: ['#050318', '#161046', '#3c1e78'],
    music: { root: 174, scale: [0, 2, 3, 7, 9], tempo: 96, wave: 'sine', bass: 'sine' },
    palette: ['#8f7bff', '#5be0ff', '#ff7be0', '#ffe27b', '#7bffb0', '#ff9d7b', '#c17bff', '#7bc4ff', '#ffbf7b'],
    shapes: ['potion', 'bottle'],
  },
  {
    id: 'jungle', name: 'Jungle World', tagline: 'Playful & wild',
    bg: ['#0e3b2e', '#166a4d', '#8fd13f'],
    music: { root: 146, scale: [0, 2, 4, 5, 7, 9], tempo: 118, wave: 'triangle', bass: 'triangle' },
    palette: ['#8fd13f', '#ffb238', '#ff6f4d', '#3fd1c1', '#c1ff38', '#ff9df0', '#38a6ff', '#ffe338'],
    shapes: ['bubble', 'candy'],
  },
  {
    id: 'endgame', name: 'Endgame World', tagline: 'Premium arcade finale',
    bg: ['#1a0022', '#4a0060', '#ff005c'],
    music: { root: 233, scale: [0, 2, 4, 6, 7, 9, 11], tempo: 140, wave: 'sawtooth', bass: 'square' },
    palette: ['#ffd700', '#ff005c', '#00e5ff', '#7cff00', '#b400ff', '#ff8a00', '#00ffa2', '#ff3df0', '#ffffff'],
    shapes: ['potion', 'capsule', 'bottle', 'jelly'],
  },
];

export const LEVELS_PER_WORLD = 8;
export const CAPACITY = 4;

export function getLevel(worldIndex, levelIndex) {
  const world = WORLDS[worldIndex];
  const key = `${world.id}-${levelIndex + 1}`;
  const data = LEVEL_DATA[key];
  if (!data) throw new Error(`No level data for ${key}`);
  return {
    id: key,
    worldIndex, levelIndex,
    containers: data.containers.map((c) => c.slice()),
    capacity: data.capacity,
    colorsCount: data.colorsCount,
    parMoves: data.parMoves,
    world,
  };
}

export function totalLevels() { return WORLDS.length * LEVELS_PER_WORLD; }

export function starsForMoves(moves, parMoves) {
  if (moves <= parMoves) return 3;
  if (moves <= Math.ceil(parMoves * 1.35)) return 2;
  return 1;
}

// Cosmetic "special liquid" flavor assigned to certain colors on certain
// levels — purely visual, never changes engine rules.
export const SPECIAL_FX = ['jelly', 'neon', 'glitter', 'soda', 'galaxy', 'lava', 'rainbow', 'bubble', 'crystal', 'electric'];

export function specialFxFor(worldIndex, levelIndex, colorIndex) {
  // The last ("boss") level of each world gets one flashy color, and each
  // world's boss unlocks the next cosmetic in the collection.
  if (levelIndex === LEVELS_PER_WORLD - 1 && colorIndex === 0) {
    return SPECIAL_FX[worldIndex % SPECIAL_FX.length];
  }
  return null;
}
