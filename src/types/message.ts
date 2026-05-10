/**
 * 消息相关类型定义
 */

// 私信消息
export interface BiliMsg {
    sender_uid: number
    receiver_id: number
    msg_type: number
    content: string
    timestamp: number
    msg_seqno: number
    msg_status?: number        // 0-正常 1-已撤回 2-被系统撤回
    msg_source?: number
    msg_key?: number
    at_uids?: number[] | null
    notify_code?: string
    new_face_version?: number
}

// 解析后的内容
export interface ParsedContent {
    text: string
    image?: string
    type_info?: "text" | "image" | "system" | "video" | "article" | "share" | "unknown"
    url?: string
    bvid?: string
    aid?: number
}

// 表情信息
export interface EmoteInfo {
    text: string
    url?: string
    uri?: string
    size?: number
}

// 表情映射表
export type EmoteMap = Record<string, string>

// 用户信息
export interface UserInfo {
    name: string
    face: string
}
