/**
 * 字符串工具函数
 */

// HTML 转义
export function escapeHtml(text: string): string {
    const div = document.createElement("div")
    div.textContent = text
    return div.innerHTML
}

// 截断字符串
export function truncate(str: string, maxLength: number): string {
    return str.length <= maxLength ? str : str.slice(0, maxLength) + "..."
}
