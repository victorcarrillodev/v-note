// Historial genérico de deshacer/rehacer por instantáneas (plan 004, DP-12). Un cambio idéntico al actual no añade paso.
export class Snapshots<T> {
  private past: T[] = [];
  private future: T[] = [];
  constructor(private now: T, private readonly same: (value: T) => string, private readonly limit = 100) {}
  get current(): T { return this.now; }
  get canUndo() { return this.past.length > 0; }
  get canRedo() { return this.future.length > 0; }
  push(next: T): void {
    if (this.same(next) === this.same(this.now)) return;
    this.past.push(this.now);
    if (this.past.length > this.limit) this.past.shift();
    this.now = next;
    this.future = [];
  }
  undo(): T | null {
    const prev = this.past.pop();
    if (prev === undefined) return null;
    this.future.push(this.now);
    this.now = prev;
    return prev;
  }
  redo(): T | null {
    const next = this.future.pop();
    if (next === undefined) return null;
    this.past.push(this.now);
    this.now = next;
    return next;
  }
}
