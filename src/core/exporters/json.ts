/**
 * JSON 导出引擎
 */

import type { BiliMsg } from "../../types/message"
import { parseMessageContent } from "../parser"

// 生成安全文件名
function makeFileName(talkerId: string, talkerName?: string): string {
    const safe = (talkerName || talkerId).replace(/[\\/:*?"<>|]/g, "_")
    const date = new Date().toISOString().split("T")[0]
    const time = new Date().toTimeString().split(" ")[0].replace(/:/g, "-")
    return `BiliChat_${safe}_${date}_${time}.json`
}

// 触发浏览器下载
function download(url: string, fileName: string): void {
    const a = document.createElement("a")
    a.href = url
    a.download = fileName
    a.style.display = "none"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
}

// 导出消息为 JSON 文件并触发下载
export function exportToJSON(talkerId: string, messages: BiliMsg[], talkerName?: string): void {
    const exportData = {
        version: "1.0",
        exportTime: new Date().toISOString(),
        talkerId,
        messageCount: messages.length,
        messages: messages.map(msg => ({
            sender_uid: msg.sender_uid,
            receiver_id: msg.receiver_id,
            msg_type: msg.msg_type,
            msg_seqno: msg.msg_seqno,
            timestamp: msg.timestamp,
            datetime: new Date(msg.timestamp * 1000).toLocaleString("zh-CN", { hour12: false }),
            content: {
                raw: msg.content,
                parsed: parseMessageContent(msg.content, msg.msg_type)
            },
            msg_status: msg.msg_status,
            msg_source: msg.msg_source
        }))
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    download(url, makeFileName(talkerId, talkerName))
    URL.revokeObjectURL(url)
}
