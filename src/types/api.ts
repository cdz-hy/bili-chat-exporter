/**
 * API 响应类型定义
 */

import type { BiliMsg, EmoteInfo } from "./message"

// 获取消息响应
export interface FetchMsgsResponse {
    messages: BiliMsg[]
    has_more: boolean
    min_seqno: number
    e_infos?: EmoteInfo[]
}

// 同步消息结果
export interface SyncMessagesResult {
    messages: BiliMsg[]
    emoteMap: Record<string, string>
}
