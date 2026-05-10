/**
 * 图片工具函数
 */

// 图片 URL 转 Base64
export async function getBase64Image(url: string): Promise<string> {
    if (!url) return ""
    try {
        const resp = await fetch(url)
        const blob = await resp.blob()
        return new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onloadend = () => resolve(reader.result as string)
            reader.onerror = reject
            reader.readAsDataURL(blob)
        })
    } catch {
        return url
    }
}

// 移除缩略图参数，获取原图 URL
export function getOriginalImageUrl(url: string): string {
    return url.replace(/@\d+w_\d+h.*$/, "")
}
