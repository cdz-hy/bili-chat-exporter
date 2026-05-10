/**
 * 配置持久化
 */

import { Storage } from "@plasmohq/storage"

export const storage = new Storage()

// PDF 标题格式
export enum TitleFormat {
    UID = "uid",
    USERNAME = "username",
    CUSTOM = "custom"
}

// 导出配置项
export interface ExportConfig {
    titleFormat: TitleFormat
    customTitle: string
    showExportTime: boolean
    showMessageTime: boolean
    showRevokedContent: boolean
    showContinuationHeader: boolean
    showPageNumbers: boolean
}

export const DEFAULT_CONFIG: ExportConfig = {
    titleFormat: TitleFormat.UID,
    customTitle: "Bilibili 聊天记录",
    showExportTime: true,
    showMessageTime: true,
    showRevokedContent: false,
    showContinuationHeader: true,
    showPageNumbers: true,
}

export const STORAGE_KEYS = {
    CONFIG: "bili_export_config"
}
