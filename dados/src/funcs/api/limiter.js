import { ApiError, ErrorCodes } from './errors.js';

export class ConcurrencyLimiter {
    constructor(options = {}) {
        this.maxConcurrent = Math.max(1, options.maxConcurrent ?? 2);
        this.maxQueue = Math.max(0, options.maxQueue ?? 20);
        this.active = 0;
        this.queue = [];
        this.peakActive = 0;
    }

    async run(task) {
        if (typeof task !== 'function') {
            throw new TypeError('task deve ser uma função');
        }

        if (this.active < this.maxConcurrent) {
            return this.execute(task);
        }

        if (this.queue.length >= this.maxQueue) {
            throw new ApiError(ErrorCodes.OVERLOADED, {
                message: 'Fila de concorrência cheia',
                recoverable: false
            });
        }

        return new Promise((resolve, reject) => {
            this.queue.push({ task, resolve, reject });
        });
    }

    async execute(task) {
        this.active++;
        this.peakActive = Math.max(this.peakActive, this.active);

        try {
            return await task();
        } finally {
            this.active--;
            this.drain();
        }
    }

    drain() {
        while (this.active < this.maxConcurrent && this.queue.length > 0) {
            const next = this.queue.shift();
            this.execute(next.task).then(next.resolve, next.reject);
        }
    }

    getStats() {
        return {
            active: this.active,
            queued: this.queue.length,
            peakActive: this.peakActive,
            maxConcurrent: this.maxConcurrent,
            maxQueue: this.maxQueue
        };
    }
}
