/**
 * 异步工具函数
 */

// 并发控制器：限制同时执行的异步任务数
export async function parallelMap<T, R>(
    array: T[],
    limit: number,
    iterator: (item: T, index: number) => Promise<R>
): Promise<R[]> {
    const results = new Array<R>(array.length)
    const executing = new Set<Promise<void>>()

    for (const [index, item] of array.entries()) {
        const task = Promise.resolve()
            .then(() => iterator(item, index))
            .then(result => { results[index] = result })
        executing.add(task)
        task.finally(() => executing.delete(task))
        if (executing.size >= limit) await Promise.race(executing)
    }

    await Promise.all(executing)
    return results
}

// 延迟
export function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
}

// 随机延迟（礼貌爬虫）
export function randomDelay(min: number, max: number): Promise<void> {
    return delay(min + Math.random() * (max - min))
}
