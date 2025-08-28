export function debounce<
    F extends (...args: any) => any,
>(func: F, delay = 300): (...args: Parameters<F>) => undefined {
    let timeout: NodeJS.Timeout;

    return function (...args: Parameters<F>): undefined {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), delay);
    };
}

export function debounceAsync<
    F extends (...args: any) => Promise<any>,
>(func: F, delay = 300): (...args: Parameters<F>) => void {
    // for some godforsaken reason it errors here if its let, but not a few lines up
    var timeout: NodeJS.Timeout;
    let running = false;

    return function (...args: Parameters<F>): undefined {
        if (running)
            return;
        running = true;
        clearTimeout(timeout);
        setTimeout(() => func(...args)
            .finally(() => void (running = false)), delay);
        return;
    };
}
