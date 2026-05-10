/**
 * B 站私信消息解析器
 * 支持 18 种消息类型，参考 bilibili-API-collect
 */

export interface ParsedContent {
    text: string
    image?: string
    type_info?: "text" | "image" | "system" | "video" | "article" | "share" | "unknown"
    url?: string
    bvid?: string
    aid?: number
    revoked?: boolean
}

// 解析消息内容，根据 msg_type 分发处理
export function parseMessageContent(rawContent: string, msgType: number): ParsedContent {
    try {
        const data = JSON.parse(rawContent)

        switch (msgType) {
            case 1: // 文本
                return { text: data.content || "", type_info: "text" }

            case 2: // 图片
                return { text: "[图片]", image: data.url, type_info: "image" }

            case 5: // 撤回
                return { text: data.content || data.text || "[撤回消息]", type_info: "text", revoked: true }

            case 7: // 视频分享（简版）
                return { text: `[视频分享] ${data.title || ""}`, image: data.cover || data.pic, url: data.jump_url, type_info: "video" }

            case 10: // 通知
                return { text: `${data.title || "[通知]"}\n${data.text || ""}`, type_info: "system" }

            case 11: { // 视频推送（含详情）
                const info = [data.title, data.desc, data.view ? `播放：${data.view}` : null, data.danmaku ? `弹幕：${data.danmaku}` : null].filter(Boolean).join("\n")
                const videoUrl = data.bvid ? `https://www.bilibili.com/video/${data.bvid}` : data.rid ? `https://www.bilibili.com/video/av${data.rid}` : ""
                return { text: `[视频推送]\n${info}`, image: data.cover || data.pic, url: videoUrl, bvid: data.bvid, aid: data.rid, type_info: "video" }
            }

            case 12: // 大表情
            case 13: // 小表情
                return { text: "[表情包]", image: data.url, type_info: "image" }

            case 14: // 专栏
                return { text: `[专栏] ${data.title || ""}`, image: data.image_urls?.[0], type_info: "article" }

            case 18: // 系统提示（可能嵌套 JSON 数组）
                try {
                    const inner = JSON.parse(data.content)
                    return { text: Array.isArray(inner) ? inner.map((i: any) => i.text).join("") : data.content, type_info: "system" }
                } catch {
                    return { text: data.content || "[系统提示]", type_info: "system" }
                }

            case 25: return { text: `[音频] ${data.title || ""}`, image: data.cover, type_info: "share" }
            case 26: return { text: `[歌单] ${data.title || ""}`, image: data.cover, type_info: "share" }
            case 27: return { text: `[直播间] ${data.title || ""}\n主播：${data.uname || ""}`, image: data.cover, type_info: "share" }
            case 28: return { text: `[番剧] ${data.title || ""}`, image: data.cover, type_info: "video" }
            case 29: return { text: `[漫画] ${data.title || ""}`, image: data.cover, type_info: "share" }
            case 30: return { text: `[装扮] ${data.title || ""}`, image: data.cover, type_info: "share" }
            case 31: return { text: `[小视频] ${data.title || ""}`, image: data.cover, type_info: "video" }
            case 32: return { text: `[相簿] ${data.title || ""}`, image: data.cover, type_info: "share" }
            case 33: return { text: `[活动] ${data.title || ""}`, image: data.cover, type_info: "share" }
            case 51: return { text: `[小程序] ${data.title || ""}`, type_info: "system" }
            case 306: return { text: data.content || "[粉丝团提示]", type_info: "system" }

            default:
                return {
                    text: data.content || data.text || data.title || `[未知类型 ${msgType}]`,
                    image: data.url || data.cover || data.pic,
                    type_info: "unknown"
                }
        }
    } catch {
        return { text: typeof rawContent === "string" ? rawContent : "[解析异常]", type_info: "unknown" }
    }
}

// 将文本中的 [表情名] 替换为 <img> 标签
export function resolveEmotes(text: string, emoteMap: Record<string, string>): string {
    if (!text) return ""
    return text.replace(/\[(.+?)\]/g, match => {
        const url = emoteMap[match]
        return url ? `<img src="${url}" class="emote" alt="${match}" style="width:22px;height:22px;vertical-align:text-bottom;margin:0 2px;" />` : match
    })
}

// 从 API 的 e_infos 构建表情映射表
export function buildEmoteMap(eInfos: Array<{ text: string; url?: string; uri?: string }>): Record<string, string> {
    const map: Record<string, string> = {}
    if (!eInfos?.length) return map
    for (const e of eInfos) {
        if (e.text && (e.url || e.uri)) map[e.text] = e.url || e.uri || ""
    }
    return map
}
