/**
 * 媒体资源打包引擎 (ZIP)
 * 遍历消息，收集所有图片、表情包与卡片封面，打包下载为 ZIP 文件
 */

import JSZip from "jszip"
import type { BiliMsg } from "../../types/message"
import { parseMessageContent } from "../parser"

interface MediaItem {
    url: string
    folder: "images" | "emotes" | "covers"
    filename: string
}

// 获取干净的 URL 和后缀名
function getUrlInfo(url: string, seqNo: number, type: string): { cleanUrl: string; filename: string } {
    // 移除 B 站图片裁剪参数
    const cleanUrl = url.replace(/@\d+w_\d+h.*$/, "").split("?")[0]
    const match = cleanUrl.match(/\.([^./\\]+)$/)
    const ext = match ? match[1].toLowerCase() : "png"
    return {
        cleanUrl,
        filename: `${type}_${seqNo}.${ext}`
    }
}

// 异步拉取资源的 ArrayBuffer
async function fetchBuffer(url: string): Promise<ArrayBuffer> {
    const resp = await fetch(url)
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    return resp.arrayBuffer()
}

// 导出媒体为主函数
export async function exportToZIP(
    talkerId: string,
    messages: BiliMsg[],
    talkerName: string,
    onProgress?: (status: string) => void
): Promise<void> {
    try {
        const zip = new JSZip()
        const mediaList: MediaItem[] = []

        onProgress?.("正在扫描消息中的媒体资源...")

        // 遍历扫描所有消息中的媒体
        for (const msg of messages) {
            const parsed = parseMessageContent(msg.content, msg.msg_type)
            if (!parsed.image) continue

            let folder: "images" | "emotes" | "covers" = "covers"
            let typePrefix = "cover"

            if (msg.msg_type === 2) {
                folder = "images"
                typePrefix = "image"
            } else if (msg.msg_type === 12 || msg.msg_type === 13) {
                folder = "emotes"
                typePrefix = "emote"
            }

            const { cleanUrl, filename } = getUrlInfo(parsed.image, msg.msg_seqno, typePrefix)
            
            // 避免重复收集
            if (!mediaList.some(item => item.url === cleanUrl)) {
                mediaList.push({
                    url: cleanUrl,
                    folder,
                    filename
                })
            }
        }

        if (mediaList.length === 0) {
            throw new Error("聊天记录中未检测到任何图片、表情或卡片封面")
        }

        onProgress?.(`共发现 ${mediaList.length} 个媒体文件，准备下载...`)

        // 6 路并发下载
        const total = mediaList.length
        let completed = 0

        for (let i = 0; i < mediaList.length; i += 6) {
            const chunk = mediaList.slice(i, i + 6)
            await Promise.all(
                chunk.map(async item => {
                    try {
                        const buffer = await fetchBuffer(item.url)
                        zip.folder(item.folder)?.file(item.filename, buffer)
                    } catch (err) {
                        console.error(`下载媒体失败: ${item.url}`, err)
                    } finally {
                        completed++
                    }
                })
            )
            onProgress?.(`正在打包媒体文件 (${completed}/${total})...`)
            // 稍作停顿以释放主线程
            await new Promise(r => setTimeout(r, 50))
        }

        onProgress?.("正在生成 ZIP 文件并压缩...")
        const content = await zip.generateAsync({ type: "blob" })

        // 触发下载
        const url = URL.createObjectURL(content)
        const a = document.createElement("a")
        a.href = url
        const safeName = (talkerName || talkerId).replace(/[\\/:*?"<>|]/g, "_")
        a.download = `BiliChat_Media_${safeName}_${new Date().toISOString().split("T")[0]}.zip`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)

        onProgress?.("打包完成！")
    } catch (e: any) {
        throw new Error(`打包媒体失败: ${e.message}`)
    }
}
