export interface ClockConfig {
  readonly startHour: number;
  readonly endHour: number;
  readonly secondsPerHour: number;
  readonly displayStepMinutes: number;
}

/**
 * The in-game working-day clock. It advances by real elapsed milliseconds
 * (never by frame count), so it runs the same at 30 or 144 fps.
 */
export class ClockSystem {
  private elapsedMs = 0;

  constructor(private readonly config: ClockConfig) {}

  get workdayMs(): number {
    return (this.config.endHour - this.config.startHour) * this.config.secondsPerHour * 1000;
  }

  /** 0 at the start of the day, 1 at closing time. */
  get progress(): number {
    return Math.min(1, this.elapsedMs / this.workdayMs);
  }

  get isOver(): boolean {
    return this.elapsedMs >= this.workdayMs;
  }

  /** Whole in-game minutes since midnight. */
  get minutesOfDay(): number {
    const span = (this.config.endHour - this.config.startHour) * 60;
    return Math.floor(this.config.startHour * 60 + this.progress * span);
  }

  get hours(): number {
    return Math.floor(this.minutesOfDay / 60);
  }

  get minutes(): number {
    return this.minutesOfDay % 60;
  }

  /** In-game hours worked so far (0..10). */
  get hoursWorked(): number {
    return this.progress * (this.config.endHour - this.config.startHour);
  }

  /** "7:00 AM" style label, rounded down to the display step so it changes calmly. */
  get label(): string {
    const step = Math.max(1, this.config.displayStepMinutes);
    const total = Math.floor(this.minutesOfDay / step) * step;
    return formatClock(Math.floor(total / 60), total % 60);
  }

  update(deltaMs: number): void {
    if (this.isOver) return;
    this.elapsedMs = Math.min(this.workdayMs, this.elapsedMs + Math.max(0, deltaMs));
  }

  reset(): void {
    this.elapsedMs = 0;
  }
}

export function formatClock(hour24: number, minute: number): string {
  const suffix = hour24 >= 12 ? 'PM' : 'AM';
  const h = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${h}:${String(minute).padStart(2, '0')} ${suffix}`;
}
