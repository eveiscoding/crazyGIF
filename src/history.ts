export class MaskHistory {
  private entries: ImageData[] = [];
  private index = -1;
  constructor(private limit = 20) {}
  push(data: ImageData) {
    this.entries = this.entries.slice(0, this.index + 1);
    this.entries.push(data);
    if (this.entries.length > this.limit) this.entries.shift();
    this.index = this.entries.length - 1;
  }
  undo() {
    if (this.canUndo) return this.entries[--this.index];
  }
  redo() {
    if (this.canRedo) return this.entries[++this.index];
  }
  current() {
    return this.entries[this.index];
  }
  get canUndo() {
    return this.index > 0;
  }
  get canRedo() {
    return this.index < this.entries.length - 1;
  }
}
