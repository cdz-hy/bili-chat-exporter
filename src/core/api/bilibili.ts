/**
 * B 站私信 API 封装
 */

import type { BiliMsg, EmoteInfo } from "../../types/message"

// 从 Cookie 提取 CSRF Token
function getCsrf(): string {
    const match = document.cookie.match(/bili_jct=([^;]+)/)
    if (!match) throw new Error("未找到 CSRF Token，请确保已登录")
    return match[1]
}

interface FetchResult {
    messages: BiliMsg[]
    has_more: boolean
    min_seqno: number
    e_infos: EmoteInfo[]
}

// 拉取一页私信（每页 20 条）
export async function fetchSessionMsgs(
    talkerId: string,
    endSeqNo: number = 0
): Promise<FetchResult> {
    const params = new URLSearchParams({
        talker_id: talkerId,
        session_type: "1",
        size: "20",
        mobi_app: "web",
        csrf: getCsrf()
    })
    if (endSeqNo > 0) params.set("end_seqno", endSeqNo.toString())

    const url = `https://api.vc.bilibili.com/svr_sync/v1/svr_sync/fetch_session_msgs?${params}`
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10000)

    try {
        const resp = await fetch(url, {
            credentials: "include",
            headers: { Accept: "application/json" },
            signal: controller.signal
        })
        clearTimeout(timer)

        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
        const json = await resp.json()
        if (json.code !== 0) throw new Error(`API 错误: ${json.message} (${json.code})`)

        return {
            messages: json.data?.messages || [],
            has_more: json.data?.has_more === 1,
            min_seqno: json.data?.min_seqno || 0,
            e_infos: json.data?.e_infos || []
        }
    } catch (e: any) {
        clearTimeout(timer)
        throw e.name === "AbortError" ? new Error("请求超时") : e
    }
}

// 递归拉取全部历史消息，同步收集表情映射
export async function syncAllMessages(
    talkerId: string,
    onProgress: (msgs: BiliMsg[]) => void
): Promise<{ messages: BiliMsg[]; emoteMap: Record<string, string> }> {
    const allMsgs: BiliMsg[] = []
    const emoteMap: Record<string, string> = {}
    let hasMore = true
    let endSeqNo = 0

    while (hasMore) {
        const result = await fetchSessionMsgs(talkerId, endSeqNo)
        if (!result.messages.length) break

        allMsgs.push(...result.messages)
        onProgress(allMsgs)

        // 收集表情
        for (const e of result.e_infos) {
            if (e.text && (e.url || e.uri)) emoteMap[e.text] = e.url || e.uri || ""
        }

        hasMore = result.has_more
        endSeqNo = result.min_seqno - 1
        if (endSeqNo <= 0) break

        // 礼貌延迟，避免触发风控
        await new Promise(r => setTimeout(r, 50 + Math.random() * 100))
    }

    return { messages: allMsgs, emoteMap }
}

// 获取用户昵称和头像
export async function getUserInfo(mid: string): Promise<{ name: string; face: string } | null> {
    try {
        const resp = await fetch(`https://api.vc.bilibili.com/account/v1/user/cards?uids=${mid}`, {
            credentials: "include",
            headers: { Accept: "application/json" }
        })
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
        const json = await resp.json()
        if (json.code !== 0 || !json.data?.length) return null
        return { name: json.data[0].name || mid, face: json.data[0].face || "" }
    } catch {
        return null
    }
}

// 图片 URL 转 Base64（用于 PDF 内嵌）
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
