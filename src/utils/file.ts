/**
 * 文件工具函数
 */

// 生成安全文件名（移除非法字符）
export function sanitizeFileName(name: string): string {
    return name.replace(/[\\/:*?"<>|]/g, "_")
}

// 生成带时间戳的文件名
export function generateFileName(prefix: string, extension: string): string {
    const date = new Date().toISOString().split("T")[0]
    const time = new Date().toTimeString().split(" ")[0].replace(/:/g, "-")
    return `${prefix}_${date}_${time}.${extension}`
}

// 触发浏览器下载
export function downloadFile(url: string, fileName: string): void {
    const a = document.createElement("a")
    a.href = url
    a.download = fileName
    a.style.display = "none"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
}
