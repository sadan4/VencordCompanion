const SYM_UNCACHED = Symbol("uncached");

/**
 * Caches the result of a function and provides an option to invalidate the cache.
 *
 * Only works on methods with no parameters
 *
 * @param invalidate An optional array of functions that a function to invalidate the cache will be pushed to.
 * @returns A decorator function that can be used to cache the result of a method.
 */
export function Cache(invalidate?: (() => void)[]) {
    type _<P extends () => any> = (...args: Parameters<P>) => ReturnType<P>;

    return function <
        P extends () => any,
    >(
        target: Object,
        propertyKey: string | symbol,
        descriptor: TypedPropertyDescriptor<_<P>>,
    ):
        TypedPropertyDescriptor<_<P>> | void {
        const sym = Symbol(`cache-${propertyKey.toString()}`);

        target[sym] = SYM_UNCACHED;

        type A = Parameters<P>;

        type R = ReturnType<P>;

        const orig = descriptor.value;

        if (typeof orig !== "function") {
            throw new Error("Not a function");
        }
        if (orig.length !== 0) {
            throw new Error("Function has parameters");
        }
        descriptor.value = function (...args: A): R {
            if (this[sym] === SYM_UNCACHED) {
                invalidate?.push(() => {
                    this[sym] = SYM_UNCACHED;
                });
                this[sym] = orig.apply(this, args);
            }
            return this[sym];
        };
    };
}
/**
 * Same thing as {@link Cache} but for getters.
 */
export function CacheGetter(invalidate?: (() => void)[]) {
    return function <T>(
        target: Object,
        propertyKey: string | symbol,
        descriptor: TypedPropertyDescriptor<T>,
    ):
        TypedPropertyDescriptor<T> | void {
        const sym = Symbol(`cache-${propertyKey.toString()}`);

        target[sym] = SYM_UNCACHED;

        const orig = descriptor?.get;

        if (typeof orig !== "function") {
            throw new Error("Not a getter");
        }
        descriptor.get = function (): T {
            if (this[sym] === SYM_UNCACHED) {
                invalidate?.push(() => {
                    this[sym] = SYM_UNCACHED;
                });
                this[sym] = orig.apply(this);
            }
            return this[sym];
        };
        return descriptor;
    };
}
