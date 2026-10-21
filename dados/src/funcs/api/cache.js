function estimateSize(value, depth = 0) {
    if (value === null || value === undefined) return 0;
    if (Buffer.isBuffer(value)) return value.length;
    if (value instanceof ArrayBuffer) return value.byteLength;
    if (ArrayBuffer.isView(value)) return value.byteLength;
    if (typeof value === 'string') return Buffer.byteLength(value, 'utf8');
    if (typeof value !== 'object') return 8;
    if (depth > 4) return 64;

    let total = 64;
    for (const item of Object.values(value)) {
        total += estimateSize(item, depth + 1);
    }
    return total;
}

export class BoundedCache {
    constructor(options = {}) {
        this.maxEntries = Math.max(0, options.maxEntries ?? 250);
        this.maxBytes = Math.max(0, options.maxBytes ?? 32 * 1024 * 1024);
        this.maxItemBytes = Math.max(0, options.maxItemBytes ?? 4 * 1024 * 1024);
        this.ttlMs = Math.max(0, options.ttlMs ?? 30 * 60 * 1000);
        this.now = options.now || Date.now;
        this.entries = new Map();
        this.bytes = 0;
        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            evictions: 0,
            skipped: 0
        };
    }

    get(key) {
        const item = this.entries.get(key);
        if (!item) {
            this.stats.misses++;
            return undefined;
        }

        if (item.expiresAt <= this.now()) {
            this.delete(key);
            this.stats.misses++;
            return undefined;
        }

        this.stats.hits++;
        return item.value;
    }

    set(key, value, options = {}) {
        const size = estimateSize(value);
        if (size > this.maxItemBytes || size > this.maxBytes || this.maxEntries === 0) {
            this.stats.skipped++;
            return false;
        }

        this.delete(key);

        const ttlMs = Math.max(0, options.ttlMs ?? this.ttlMs);
        while (
            this.entries.size >= this.maxEntries
            || this.bytes + size > this.maxBytes
        ) {
            const oldestKey = this.entries.keys().next().value;
            if (oldestKey === undefined) break;
            this.delete(oldestKey, true);
        }

        this.entries.set(key, {
            value,
            size,
            expiresAt: ttlMs === 0 ? Infinity : this.now() + ttlMs
        });
        this.bytes += size;
        this.stats.sets++;
        return true;
    }

    delete(key, eviction = false) {
        const item = this.entries.get(key);
        if (!item) return false;

        this.entries.delete(key);
        this.bytes = Math.max(0, this.bytes - item.size);
        if (eviction) this.stats.evictions++;
        return true;
    }

    clear() {
        this.entries.clear();
        this.bytes = 0;
    }

    get size() {
        return this.entries.size;
    }

    getStats() {
        return {
            ...this.stats,
            size: this.entries.size,
            bytes: this.bytes,
            maxEntries: this.maxEntries,
            maxBytes: this.maxBytes
        };
    }
}
