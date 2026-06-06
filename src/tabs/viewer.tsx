import React, { useState, useMemo, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
    Upload, Search, MessageSquare, Image as ImageIcon, Calendar, 
    User, ArrowUp, ArrowDown, BarChart2, Eye, ShieldAlert
} from "lucide-react"
import type { BiliMsg } from "../types/message"
import { parseMessageContent } from "../core/parser"
import "../style.css"

interface ExportedJSON {
    version: string
    exportTime: string
    talkerId: string
    talkerName?: string
    messageCount: number
    emoteMap?: Record<string, string>
    messages: Array<{
        sender_uid: number
        receiver_id: number
        msg_type: number
        msg_seqno: number
        timestamp: number
        datetime: string
        content: {
            raw: string
            parsed: ReturnType<typeof parseMessageContent>
        }
        msg_status?: number
        msg_source?: number
    }>
}

const OfflineViewer = () => {
    const [jsonData, setJsonData] = useState<ExportedJSON | null>(null)
    const [searchQuery, setSearchQuery] = useState("")
    const [error, setError] = useState<string | null>(null)
    const [dragActive, setDragActive] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const messagesTopRef = useRef<HTMLDivElement>(null)

    // 处理拖拽事件
    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true)
        } else if (e.type === "dragleave") {
            setDragActive(false)
        }
    }

    // 处理文件解析
    const parseJSONFile = (file: File) => {
        setError(null)
        if (file.type !== "application/json" && !file.name.endsWith(".json")) {
            setError("请上传以 .json 结尾的聊天记录导出文件")
            return
        }

        const reader = new FileReader()
        reader.onload = (e) => {
            try {
                const parsed = JSON.parse(e.target?.result as string) as ExportedJSON
                if (!parsed.messages || !Array.isArray(parsed.messages)) {
                    throw new Error("格式无效，未找到 messages 对话字段")
                }
                setJsonData(parsed)
            } catch (err: any) {
                setError(`解析失败: ${err.message || "无效的 JSON 格式"}`)
            }
        }
        reader.onerror = () => setError("读取文件出错")
        reader.readAsText(file)
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setDragActive(false)
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            parseJSONFile(e.dataTransfer.files[0])
        }
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            parseJSONFile(e.target.files[0])
        }
    }

    // 聊天双方 UID 检测
    const userUids = useMemo(() => {
        if (!jsonData) return { talkerId: 0, selfId: 0 }
        const talkerId = parseInt(jsonData.talkerId)
        let selfId = 0
        for (const m of jsonData.messages) {
            if (m.sender_uid !== talkerId) {
                selfId = m.sender_uid
                break
            }
        }
        return { talkerId, selfId }
    }, [jsonData])

    // 统计分析
    const stats = useMemo(() => {
        if (!jsonData) return null
        const total = jsonData.messages.length
        let images = 0
        let emotes = 0
        let sentBySelf = 0
        let revoked = 0

        jsonData.messages.forEach(m => {
            const parsed = m.content.parsed
            if (m.sender_uid === userUids.selfId) sentBySelf++
            if (parsed.type_info === "image" || m.msg_type === 2) images++
            if (m.msg_type === 12 || m.msg_type === 13) emotes++
            if (m.msg_status === 1 || m.msg_status === 2 || m.msg_type === 5) revoked++
        })

        const dates = jsonData.messages.map(m => m.timestamp)
        const dateRange = dates.length > 0 ? {
            start: new Date(Math.min(...dates) * 1000).toLocaleDateString(),
            end: new Date(Math.max(...dates) * 1000).toLocaleDateString()
        } : null

        return {
            total,
            images,
            emotes,
            sentBySelf,
            sentByTalker: total - sentBySelf,
            revoked,
            dateRange
        }
    }, [jsonData, userUids])

    // 渲染表情
    const renderMessageText = (text: string) => {
        if (!text) return ""
        const emoteMap = jsonData?.emoteMap || {}
        const parts = []
        let last = 0
        const re = /\[(.+?)\]/g
        let m
        let index = 0

        while ((m = re.exec(text)) !== null) {
            if (m.index > last) {
                parts.push(text.slice(last, m.index))
            }
            const url = emoteMap[m[0]]
            if (url) {
                parts.push(
                    <img 
                        key={`emote-${index++}`} 
                        src={url} 
                        alt={m[0]} 
                        className="plasmo-w-[22px] plasmo-h-[22px] plasmo-inline-block plasmo-vertical-align-text-bottom plasmo-mx-0.5" 
                    />
                )
            } else {
                parts.push(m[0])
            }
            last = re.lastIndex
        }
        if (last < text.length) {
            parts.push(text.slice(last))
        }
        return parts.length > 0 ? parts : text
    }

    // 消息搜索过滤
    const filteredMessages = useMemo(() => {
        if (!jsonData) return []
        const query = searchQuery.toLowerCase().trim()
        if (!query) return [...jsonData.messages].reverse() // 转为时间正序
        
        return [...jsonData.messages].reverse().filter(m => {
            const text = m.content.parsed?.text || ""
            return text.toLowerCase().includes(query)
        })
    }, [jsonData, searchQuery])

    // 一键滚动
    const scrollTo = (position: "top" | "bottom") => {
        if (position === "top") {
            messagesTopRef.current?.scrollIntoView({ behavior: "smooth" })
        } else {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
        }
    }

    // 渲染消息气泡
    const renderBubble = (m: ExportedJSON["messages"][0]) => {
        const p = m.content.parsed
        const isRevoked = m.msg_status === 1 || m.msg_status === 2 || m.msg_type === 5

        if (isRevoked) {
            return (
                <div className="plasmo-p-3 plasmo-rounded-xl plasmo-text-xs plasmo-bg-gray-100 plasmo-text-gray-400 plasmo-border plasmo-border-dashed">
                    [消息已撤回] {p.text && <span className="plasmo-italic plasmo-opacity-70">({p.text})</span>}
                </div>
            )
        }

        if (p.type_info === "system") {
            return (
                <div className="plasmo-text-xs plasmo-text-gray-400 plasmo-bg-gray-50 plasmo-py-1 plasmo-px-3 plasmo-rounded-lg plasmo-max-w-[80%] plasmo-text-center">
                    {p.text}
                </div>
            )
        }

        if ((p.type_info === "image" || m.msg_type === 2) && p.image) {
            return (
                <div className="plasmo-overflow-hidden plasmo-rounded-xl plasmo-border plasmo-border-gray-200">
                    <img 
                        src={p.image} 
                        alt="图片" 
                        className="plasmo-max-w-[260px] plasmo-max-h-[360px] plasmo-cursor-zoom-in hover:plasmo-opacity-95 plasmo-transition-opacity" 
                        onClick={() => window.open(p.image)}
                    />
                </div>
            )
        }

        if (p.type_info === "video" || p.type_info === "article" || p.type_info === "share") {
            return (
                <div 
                    onClick={() => p.url && window.open(p.url, "_blank")}
                    className="plasmo-flex plasmo-gap-3 plasmo-p-3 plasmo-bg-gray-50 hover:plasmo-bg-gray-100 plasmo-border plasmo-border-gray-200 plasmo-rounded-xl plasmo-cursor-pointer plasmo-transition-all plasmo-max-w-[320px] plasmo-group"
                >
                    {p.image && <img src={p.image} className="plasmo-w-20 plasmo-h-14 plasmo-object-cover plasmo-rounded-lg plasmo-bg-gray-200 flex-shrink-0" alt="" />}
                    <div className="plasmo-flex plasmo-flex-col plasmo-justify-between plasmo-min-w-0">
                        <span className="plasmo-text-xs plasmo-font-bold plasmo-text-gray-800 plasmo-line-clamp-2 plasmo-leading-snug">{p.text}</span>
                        {p.url && <span className="plasmo-text-[10px] plasmo-text-bili-blue plasmo-truncate plasmo-mt-1">{p.url}</span>}
                    </div>
                </div>
            )
        }

        return (
            <div className={`plasmo-p-3 plasmo-rounded-xl plasmo-text-sm plasmo-leading-relaxed plasmo-break-all plasmo-white-space-pre-wrap ${
                m.sender_uid === userUids.selfId 
                    ? "plasmo-bg-bili-pink plasmo-text-white plasmo-rounded-tr-none" 
                    : "plasmo-bg-gray-100 plasmo-text-gray-800 plasmo-rounded-tl-none"
            }`}>
                {renderMessageText(p.text)}
            </div>
        )
    }

    return (
        <div className="plasmo-w-screen plasmo-h-screen plasmo-bg-gray-50 plasmo-flex plasmo-font-sans">
            {/* 上传前界面 */}
            <AnimatePresence>
                {!jsonData && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="plasmo-w-full plasmo-h-full plasmo-flex plasmo-flex-col plasmo-items-center plasmo-justify-center plasmo-p-6"
                    >
                        <div className="plasmo-max-w-md plasmo-w-full plasmo-bg-white plasmo-rounded-3xl plasmo-shadow-xl plasmo-p-8 plasmo-border plasmo-border-gray-100">
                            <div className="plasmo-flex plasmo-items-center plasmo-gap-3 plasmo-mb-6">
                                <div className="plasmo-w-12 plasmo-h-12 plasmo-bg-pink-50 plasmo-rounded-2xl plasmo-flex plasmo-items-center plasmo-justify-center">
                                    <Eye className="plasmo-text-bili-pink" size={24} />
                                </div>
                                <div>
                                    <h1 className="plasmo-text-xl plasmo-font-black plasmo-text-gray-900">离线 JSON 阅读器</h1>
                                    <p className="plasmo-text-xs plasmo-text-gray-400">导入导出的聊天数据，还原对话现场</p>
                                </div>
                            </div>

                            {/* 拖拽区 */}
                            <div 
                                onDragEnter={handleDrag}
                                onDragOver={handleDrag}
                                onDragLeave={handleDrag}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                                className={`plasmo-border-2 plasmo-border-dashed plasmo-rounded-2xl plasmo-p-8 plasmo-flex plasmo-flex-col plasmo-items-center plasmo-justify-center plasmo-cursor-pointer plasmo-transition-all ${
                                    dragActive 
                                        ? "plasmo-border-bili-pink plasmo-bg-pink-50/20" 
                                        : "plasmo-border-gray-200 hover:plasmo-border-bili-pink hover:plasmo-bg-gray-50/50"
                                }`}
                            >
                                <Upload size={36} className="plasmo-text-gray-300 plasmo-mb-4" />
                                <span className="plasmo-text-sm plasmo-font-bold plasmo-text-gray-600">拖拽 JSON 文件到此处</span>
                                <span className="plasmo-text-xs plasmo-text-gray-400 plasmo-mt-1">或点击浏览本地文件</span>
                                <input 
                                    type="file" 
                                    ref={fileInputRef} 
                                    onChange={handleFileChange} 
                                    accept=".json" 
                                    className="plasmo-hidden" 
                                />
                            </div>

                            {/* 错误提示 */}
                            {error && (
                                <motion.div 
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="plasmo-mt-4 plasmo-flex plasmo-items-center plasmo-gap-2 plasmo-p-3 plasmo-bg-red-50 plasmo-text-red-600 plasmo-rounded-xl plasmo-text-xs plasmo-font-medium"
                                >
                                    <ShieldAlert size={16} />
                                    <span>{error}</span>
                                </motion.div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* 上传后阅读器主界面 */}
            {jsonData && stats && (
                <div className="plasmo-flex plasmo-flex-1 plasmo-h-full">
                    {/* 左侧侧边栏：统计分析 */}
                    <div className="plasmo-w-[280px] plasmo-bg-white plasmo-border-r plasmo-border-gray-100 plasmo-p-6 plasmo-flex plasmo-flex-col plasmo-justify-between">
                        <div className="plasmo-space-y-6">
                            <div>
                                <h2 className="plasmo-text-lg plasmo-font-black plasmo-text-gray-900">数据概览</h2>
                                <p className="plasmo-text-[10px] plasmo-text-gray-400 plasmo-mt-1">与 {jsonData.talkerName || jsonData.talkerId} 的聊天记录</p>
                            </div>

                            <div className="plasmo-space-y-4">
                                <div className="plasmo-flex plasmo-items-center plasmo-gap-3">
                                    <div className="plasmo-p-2 plasmo-bg-gray-50 plasmo-rounded-xl">
                                        <MessageSquare size={16} className="plasmo-text-gray-500" />
                                    </div>
                                    <div>
                                        <div className="plasmo-text-xs plasmo-text-gray-400">总消息量</div>
                                        <div className="plasmo-text-sm plasmo-font-black plasmo-text-gray-800">{stats.total} 条</div>
                                    </div>
                                </div>

                                <div className="plasmo-flex plasmo-items-center plasmo-gap-3">
                                    <div className="plasmo-p-2 plasmo-bg-gray-50 plasmo-rounded-xl">
                                        <ImageIcon size={16} className="plasmo-text-gray-500" />
                                    </div>
                                    <div>
                                        <div className="plasmo-text-xs plasmo-text-gray-400">图片/表情</div>
                                        <div className="plasmo-text-sm plasmo-font-black plasmo-text-gray-800">{stats.images + stats.emotes} 个</div>
                                    </div>
                                </div>

                                <div className="plasmo-flex plasmo-items-center plasmo-gap-3">
                                    <div className="plasmo-p-2 plasmo-bg-gray-50 plasmo-rounded-xl">
                                        <Calendar size={16} className="plasmo-text-gray-500" />
                                    </div>
                                    <div>
                                        <div className="plasmo-text-xs plasmo-text-gray-400">时间跨度</div>
                                        <div className="plasmo-text-xs plasmo-font-bold plasmo-text-gray-800">
                                            {stats.dateRange ? `${stats.dateRange.start} - ${stats.dateRange.end}` : "无"}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="plasmo-pt-6 plasmo-border-t plasmo-border-gray-100">
                                <div className="plasmo-flex plasmo-items-center plasmo-gap-2 plasmo-mb-3 plasmo-text-xs plasmo-font-bold plasmo-text-gray-500">
                                    <BarChart2 size={14} />
                                    <span>消息发送比例</span>
                                </div>
                                <div className="plasmo-w-full plasmo-h-2.5 plasmo-bg-gray-100 plasmo-rounded-full plasmo-overflow-hidden plasmo-flex">
                                    <div 
                                        style={{ width: `${(stats.sentBySelf / stats.total) * 100}%` }} 
                                        className="plasmo-bg-bili-pink plasmo-h-full" 
                                    />
                                    <div 
                                        style={{ width: `${(stats.sentByTalker / stats.total) * 100}%` }} 
                                        className="plasmo-bg-gray-300 plasmo-h-full" 
                                    />
                                </div>
                                <div className="plasmo-flex plasmo-justify-between plasmo-text-[10px] plasmo-text-gray-400 plasmo-mt-1.5 font-bold">
                                    <span>我: {Math.round((stats.sentBySelf / stats.total) * 100)}%</span>
                                    <span>对方: {Math.round((stats.sentByTalker / stats.total) * 100)}%</span>
                                </div>
                            </div>
                        </div>

                        <button 
                            onClick={() => { setJsonData(null); setSearchQuery(""); }}
                            className="plasmo-w-full plasmo-py-2.5 plasmo-bg-gray-50 hover:plasmo-bg-gray-100 plasmo-text-gray-600 plasmo-rounded-xl plasmo-text-xs plasmo-font-bold plasmo-transition-colors plasmo-flex plasmo-items-center plasmo-justify-center plasmo-gap-1"
                        >
                            <Upload size={14} />
                            <span>重新上传文件</span>
                        </button>
                    </div>

                    {/* 右侧主聊天面板 */}
                    <div className="plasmo-flex-1 plasmo-flex plasmo-flex-col plasmo-h-full plasmo-bg-white plasmo-relative">
                        {/* 聊天顶部栏 */}
                        <div className="plasmo-px-6 plasmo-py-4 plasmo-border-b plasmo-border-gray-100 plasmo-flex plasmo-items-center plasmo-justify-between">
                            <div>
                                <h3 className="plasmo-font-black plasmo-text-gray-800 plasmo-text-base">
                                    {jsonData.talkerName || `UID: ${jsonData.talkerId}`}
                                </h3>
                                <p className="plasmo-text-xs plasmo-text-gray-400 plasmo-mt-0.5">对话消息 ({filteredMessages.length} / {stats.total})</p>
                            </div>

                            {/* 搜索框 */}
                            <div className="plasmo-relative plasmo-w-64">
                                <input 
                                    type="text" 
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    placeholder="搜索聊天文字..." 
                                    className="plasmo-w-full plasmo-pl-9 plasmo-pr-4 plasmo-py-2 plasmo-text-xs plasmo-border plasmo-border-gray-200 plasmo-rounded-xl focus:plasmo-outline-none focus:plasmo-border-bili-pink focus:plasmo-ring-2 focus:plasmo-ring-pink-100 plasmo-transition-all"
                                />
                                <Search className="plasmo-absolute plasmo-left-3 plasmo-top-2.5 plasmo-text-gray-400" size={14} />
                            </div>
                        </div>

                        {/* 聊天内容列表 */}
                        <div className="plasmo-flex-1 plasmo-overflow-y-auto plasmo-p-6 plasmo-space-y-6">
                            <div ref={messagesTopRef} />
                            {filteredMessages.map((m, idx) => {
                                const isMe = m.sender_uid === userUids.selfId
                                const showTime = m.datetime

                                // 日期分割线
                                const showDateDivider = idx === 0 || 
                                    new Date(m.timestamp * 1000).toDateString() !== 
                                    new Date(filteredMessages[idx - 1].timestamp * 1000).toDateString()

                                return (
                                    <div key={m.msg_seqno} className="plasmo-space-y-3">
                                        {showDateDivider && (
                                            <div className="plasmo-flex plasmo-justify-center plasmo-my-4">
                                                <span className="plasmo-text-[10px] plasmo-font-bold plasmo-text-gray-400 plasmo-bg-gray-100 plasmo-px-3 plasmo-py-1 plasmo-rounded-full">
                                                    {new Date(m.timestamp * 1000).toLocaleDateString("zh-CN", {
                                                        year: 'numeric', month: 'long', day: 'numeric'
                                                    })}
                                                </span>
                                            </div>
                                        )}

                                        {/* 系统消息 */}
                                        {m.content.parsed?.type_info === "system" ? (
                                            <div className="plasmo-flex plasmo-justify-center">
                                                {renderBubble(m)}
                                            </div>
                                        ) : (
                                            /* 气泡消息 */
                                            <div className={`plasmo-flex plasmo-gap-3 ${isMe ? "plasmo-flex-row-reverse" : "plasmo-flex-row"}`}>
                                                {/* 头像占位 */}
                                                <div className={`plasmo-w-9 plasmo-h-9 plasmo-rounded-full plasmo-flex plasmo-items-center plasmo-justify-center plasmo-text-white plasmo-font-black plasmo-text-sm plasmo-flex-shrink-0 ${
                                                    isMe ? "plasmo-bg-bili-pink" : "plasmo-bg-bili-blue"
                                                }`}>
                                                    {isMe ? "我" : (jsonData.talkerName?.substring(0, 1) || "他")}
                                                </div>

                                                <div className={`plasmo-flex plasmo-flex-col plasmo-max-w-[70%] ${isMe ? "plasmo-items-end" : "plasmo-items-start"}`}>
                                                    <span className="plasmo-text-[10px] plasmo-text-gray-400 plasmo-mb-1 font-bold">
                                                        {isMe ? "我" : (jsonData.talkerName || `UID: ${m.sender_uid}`)}
                                                    </span>
                                                    <div className={`plasmo-flex plasmo-items-end plasmo-gap-2 ${isMe ? "plasmo-flex-row-reverse" : "plasmo-flex-row"}`}>
                                                        {renderBubble(m)}
                                                        <span className="plasmo-text-[9px] plasmo-text-gray-300 plasmo-whitespace-nowrap plasmo-mb-1">
                                                            {new Date(m.timestamp * 1000).toLocaleTimeString("zh-CN", {
                                                                hour: '2-digit', minute: '2-digit'
                                                            })}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* 悬浮一键滚动按钮 */}
                        <div className="plasmo-absolute plasmo-bottom-6 plasmo-right-6 plasmo-flex plasmo-flex-col plasmo-gap-2">
                            <button 
                                onClick={() => scrollTo("top")}
                                className="plasmo-w-9 plasmo-h-9 plasmo-bg-white hover:plasmo-bg-gray-50 plasmo-text-gray-400 hover:plasmo-text-bili-pink plasmo-rounded-full plasmo-shadow-md plasmo-flex plasmo-items-center plasmo-justify-center plasmo-border plasmo-border-gray-100 plasmo-transition-colors"
                                title="回到顶部"
                            >
                                <ArrowUp size={16} />
                            </button>
                            <button 
                                onClick={() => scrollTo("bottom")}
                                className="plasmo-w-9 plasmo-h-9 plasmo-bg-white hover:plasmo-bg-gray-50 plasmo-text-gray-400 hover:plasmo-text-bili-pink plasmo-rounded-full plasmo-shadow-md plasmo-flex plasmo-items-center plasmo-justify-center plasmo-border plasmo-border-gray-100 plasmo-transition-colors"
                                title="滑到底部"
                            >
                                <ArrowDown size={16} />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default OfflineViewer
