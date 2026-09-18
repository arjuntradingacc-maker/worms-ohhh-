// Orchestrates one level playthrough: wires the pure LiquidPuzzle engine to
// the Scene renderer, audio, haptics and the combo system. This is the
// "game feel" glue layer — every tap flows through here.

import { LiquidPuzzle } from './engine.js';
import { specialFxFor, starsForMoves } from './levels.js';
import { hexToHue, Emitter } from '../core/utils.js';
import * as audio from '../core/audio.js';
import { haptic } from '../core/haptics.js';

export class GameSession extends Emitter {
  constructor(scene, level) {
    super();
    this.scene = scene;
    this.level = level;
    this.engine = new LiquidPuzzle({ containers: level.containers, capacity: level.capacity, colorsCount: level.colorsCount });
    this.selected = -1;
    this.combo = 0;
    this.locked = false; // true while an animation is in flight
    this.won = false;

    const specialFxByColor = {};
    for (let c = 0; c < level.colorsCount; c++) {
      const fx = specialFxFor(level.worldIndex, level.levelIndex, c);
      if (fx) specialFxByColor[c] = fx;
    }
    scene.setLevel(level, specialFxByColor);
  }

  get moves() { return this.engine.moves; }

  undo() {
    if (this.locked || this.won) return false;
    const last = this.engine.undo();
    if (!last) return false;
    this.scene.containers[last.from].colors = this.engine.containers[last.from].slice();
    this.scene.containers[last.to].colors = this.engine.containers[last.to].slice();
    this.scene.containers[last.from].fillUnits = this.engine.containers[last.from].length;
    this.scene.containers[last.to].fillUnits = this.engine.containers[last.to].length;
    this._clearSelection();
    this.combo = 0;
    this.emit('moves', this.moves);
    return true;
  }

  handleTap(index) {
    if (this.locked || this.won) return;
    audio.unlockAudio();

    if (this.selected === -1) {
      if (this.engine.isEmpty(index)) return; // nothing to pick up
      this.selected = index;
      this.scene.selectContainer(index);
      audio.playSelect();
      haptic('select');
      this.scene.mascot.poke();
      return;
    }

    if (this.selected === index) {
      this.scene.deselectContainer(index);
      this.selected = -1;
      return;
    }

    const from = this.selected;
    const to = index;
    if (!this.engine.canPour(from, to)) {
      this.scene.deselectContainer(from);
      this.scene.invalidMove(to);
      audio.playInvalid();
      haptic('invalid');
      this.combo = 0;
      this.emit('combo', 0);
      this.selected = -1;
      return;
    }

    this.scene.deselectContainer(from);
    this.selected = -1;
    this.locked = true;

    const result = this.engine.pour(from, to);
    const hue = hexToHue(this.scene.colorHex(result.color));
    audio.playPour(hue);
    haptic('pour');
    this.combo++;
    this.emit('combo', this.combo);
    audio.playCombo(this.combo);
    this.emit('moves', this.moves);

    const newState = this.engine.containers;
    this.scene.animatePour(result, newState).then(() => {
      this.locked = false;
      if (result.destSolved) {
        audio.playPerfect();
        haptic('perfect');
      }
      if (result.levelSolved) {
        this._finishLevel();
      }
    });
  }

  _clearSelection() {
    if (this.selected !== -1) this.scene.deselectContainer(this.selected);
    this.selected = -1;
  }

  _finishLevel() {
    this.won = true;
    const stars = starsForMoves(this.moves, this.level.parMoves);
    this.emit('win', { stars, moves: this.moves, parMoves: this.level.parMoves });
  }

  resign() {
    this.locked = true; // stop further input once a level is being torn down
  }
}
