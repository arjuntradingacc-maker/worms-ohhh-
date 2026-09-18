// Pure liquid-sorting simulation. No DOM, no canvas, no audio — this
// module only knows about containers (arrays of color ids, index 0 =
// bottom) and the rules for pouring between them. Kept pure so it can be
// unit-tested head­less and so the renderer never has to guess game state.

export class LiquidPuzzle {
  constructor({ containers, capacity, colorsCount }) {
    this.capacity = capacity;
    this.colorsCount = colorsCount;
    this.containers = containers.map((c) => c.slice());
    this.moves = 0;
    this.history = [];
    this.solvedContainers = new Set();
  }

  clone() {
    const p = new LiquidPuzzle({
      containers: this.containers, capacity: this.capacity, colorsCount: this.colorsCount,
    });
    p.moves = this.moves;
    return p;
  }

  topColor(i) {
    const c = this.containers[i];
    return c.length ? c[c.length - 1] : null;
  }

  isEmpty(i) { return this.containers[i].length === 0; }
  isFull(i) { return this.containers[i].length >= this.capacity; }

  // How many like-colored units sit on top of container i.
  topRunLength(i) {
    const c = this.containers[i];
    if (!c.length) return 0;
    const top = c[c.length - 1];
    let n = 0;
    for (let k = c.length - 1; k >= 0 && c[k] === top; k--) n++;
    return n;
  }

  isContainerSolved(i) {
    const c = this.containers[i];
    if (c.length === 0) return true;
    if (c.length !== this.capacity) return false;
    return c.every((v) => v === c[0]);
  }

  canPour(from, to) {
    if (from === to) return false;
    if (this.isEmpty(from)) return false;
    if (this.isFull(to)) return false;
    const topFrom = this.topColor(from);
    const topTo = this.topColor(to);
    if (topTo !== null && topTo !== topFrom) return false;
    return true;
  }

  pourAmount(from, to) {
    if (!this.canPour(from, to)) return 0;
    const room = this.capacity - this.containers[to].length;
    return Math.min(this.topRunLength(from), room);
  }

  // Applies the pour and returns a result descriptor, or null if illegal.
  pour(from, to) {
    const amount = this.pourAmount(from, to);
    if (amount <= 0) return null;
    const color = this.topColor(from);
    for (let k = 0; k < amount; k++) {
      this.containers[from].pop();
      this.containers[to].push(color);
    }
    this.moves++;
    this.history.push({ from, to, amount, color });
    const destSolved = this.isContainerSolved(to) && this.containers[to].length === this.capacity;
    return {
      from, to, amount, color,
      fromEmptied: this.isEmpty(from),
      destFull: this.isFull(to),
      destSolved,
      levelSolved: this.isSolved(),
    };
  }

  undo() {
    const last = this.history.pop();
    if (!last) return null;
    for (let k = 0; k < last.amount; k++) {
      this.containers[last.to].pop();
      this.containers[last.from].push(last.color);
    }
    this.moves = Math.max(0, this.moves - 1);
    return last;
  }

  isSolved() {
    for (let i = 0; i < this.containers.length; i++) {
      if (!this.isContainerSolved(i)) return false;
    }
    return true;
  }

  legalMoves() {
    const out = [];
    for (let i = 0; i < this.containers.length; i++) {
      for (let j = 0; j < this.containers.length; j++) {
        if (this.canPour(i, j)) out.push([i, j]);
      }
    }
    return out;
  }
}
