export class AsyncLimiter {
  private readonly maxConcurrent: number;
  private readonly queue: Array<() => void> = [];
  private running = 0;

  constructor(maxConcurrent: number) {
    if (!Number.isInteger(maxConcurrent) || maxConcurrent < 1) {
      throw new Error(`maxConcurrent must be >= 1, received ${maxConcurrent}`);
    }
    this.maxConcurrent = maxConcurrent;
  }

  run<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const execute = () => {
        this.running += 1;

        void task()
          .then(resolve)
          .catch(reject)
          .finally(() => {
            this.running -= 1;
            this.dequeue();
          });
      };

      if (this.running < this.maxConcurrent) {
        execute();
      } else {
        this.queue.push(execute);
      }
    });
  }

  private dequeue(): void {
    if (this.running >= this.maxConcurrent) {
      return;
    }

    const next = this.queue.shift();
    if (next) {
      next();
    }
  }
}
