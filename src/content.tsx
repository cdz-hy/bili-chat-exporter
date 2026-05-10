import type { PlasmoCSConfig, PlasmoGetOverlayAnchor, PlasmoGetStyle } from "plasmo"
import { useState, useEffect, useRef } from "react"
import { Download, X, MessageSquare, FileJson, FileText } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { useStorage } from "@plasmohq/storage/hook"
import { syncAllMessages, getUserInfo, type BiliMsg } from "./core/api"
import { exportToJSON } from "./core/exporters/json"
import { exportToPDF } from "./core/exporters/pdf"
import { DEFAULT_CONFIG, STORAGE_KEYS, type ExportConfig } from "./core/storage"
import cssText from "data-text:./style.css"

// 注入规则：仅 B 站私信页面
export const config: PlasmoCSConfig = {
    matches: ["https://message.bilibili.com/*"]
}

// 样式注入到 Shadow DOM
export const getStyle: PlasmoGetStyle = () => {
    const style = document.createElement("style")
    style.textContent = cssText
    return style
}

// 挂载锚点：优先匹配页面标题栏
export const getOverlayAnchor: PlasmoGetOverlayAnchor = async () => {
    return (
        document.querySelector(".m-header .title") ||
        document.querySelector(".m-header") ||
        document.querySelector(".chat-header") ||
        document.body
    )
}

// Content Script 主组件
const BiliChatExporterUI = () => {
    const [talkerId, setTalkerId] = useState<string | null>(null)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [isExporting, setIsExporting] = useState(false)
    const [messages, setMessages] = useState<BiliMsg[]>([])
    const [exportConfig] = useStorage<ExportConfig>(STORAGE_KEYS.CONFIG, DEFAULT_CONFIG)
    const [progressText, setProgressText] = useState("正在初始化导出引擎...")
    const talkerIdRef = useRef<string | null>(null)

    useEffect(() => { talkerIdRef.current = talkerId }, [talkerId])

    // 路由感应：通过多种方式检测 URL 变化，锁定当前对话对象 UID
    useEffect(() => {
        const detect = () => {
            const hash = window.location.hash
            const pathname = window.location.pathname
            // 支持 #/whisper/mid123456 和 #mid=123456 等格式
            const match = hash.match(/mid[=\/]?(\d+)/) || pathname.match(/mid[=\/]?(\d+)/)
            const newId = match ? match[1] : null
            const currentId = talkerIdRef.current

            if (newId && newId !== currentId) {
                setTalkerId(newId)
                setMessages([])
                setIsModalOpen(false)
            } else if (!newId && currentId) {
                setTalkerId(null)
                setMessages([])
                setIsModalOpen(false)
            }
        }

        detect()
        window.addEventListener("hashchange", detect)
        window.addEventListener("popstate", detect)
        const poll = setInterval(detect, 500)
        const handleClick = () => setTimeout(detect, 100)
        document.addEventListener("click", handleClick, true)

        return () => {
            window.removeEventListener("hashchange", detect)
            window.removeEventListener("popstate", detect)
            clearInterval(poll)
            document.removeEventListener("click", handleClick, true)
        }
    }, [])

    // PDF 导出流程
    const handlePDFExport = async () => {
        if (!talkerId) return
        setIsExporting(true)
        setProgressText("正在获取用户信息...")
        try {
            const userInfo = await getUserInfo(talkerId)
            const talkerName = userInfo?.name || talkerId

            setProgressText("正在同步历史消息...")
            const result = await syncAllMessages(talkerId, m => {
                setMessages(m)
                setProgressText(`已同步 ${m.length} 条消息...`)
            })

            await exportToPDF(talkerId, result.messages, exportConfig, talkerName, result.emoteMap, status => {
                setProgressText(status)
            })
        } catch (e: any) {
            alert("PDF 导出中断: " + e.message)
        } finally {
            setIsExporting(false)
        }
    }

    // JSON 导出流程
    const handleJSONExport = async () => {
        if (!talkerId) return
        setIsExporting(true)
        setProgressText("正在获取用户信息...")
        try {
            const userInfo = await getUserInfo(talkerId)
            const talkerName = userInfo?.name || talkerId

            setProgressText("正在准备 JSON 数据...")
            const result = await syncAllMessages(talkerId, m => {
                setMessages(m)
                setProgressText(`已同步 ${m.length} 条消息...`)
            })

            exportToJSON(talkerId, result.messages, talkerName)
            setProgressText("导出完成！")
        } catch (e: any) {
            alert("JSON 导出失败: " + e.message)
        } finally {
            setIsExporting(false)
        }
    }

    // 未检测到对话对象时不渲染
    if (!talkerId) return null

    return (
        <div className="plasmo-z-[1000] plasmo-ml-4">
            {/* 触发按钮 */}
            <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsModalOpen(true)}
                className="plasmo-flex plasmo-items-center plasmo-gap-2 plasmo-px-3 plasmo-py-1.5 plasmo-bg-gradient-to-r plasmo-from-bili-pink plasmo-to-pink-500 plasmo-text-white plasmo-rounded-lg plasmo-shadow-md plasmo-shadow-pink-200 plasmo-transition-all plasmo-group"
            >
                <Download size={14} className="group-hover:plasmo-animate-bounce" />
                <span className="plasmo-font-bold plasmo-text-xs">导出此对话</span>
            </motion.button>

            {/* 导出弹窗 */}
            <AnimatePresence>
                {isModalOpen && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="plasmo-fixed plasmo-inset-0 plasmo-flex plasmo-items-center plasmo-justify-center plasmo-bg-black/60 plasmo-backdrop-blur-sm">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            transition={{ type: "spring", damping: 25, stiffness: 300 }}
                            className="plasmo-bg-white plasmo-p-8 plasmo-rounded-3xl plasmo-shadow-2xl plasmo-w-[400px] plasmo-relative"
                        >
                            {/* 关闭按钮 */}
                            <motion.button whileHover={{ scale: 1.1, rotate: 90 }} whileTap={{ scale: 0.9 }} onClick={() => setIsModalOpen(false)} className="plasmo-absolute plasmo-top-6 plasmo-right-6 plasmo-text-gray-400 hover:plasmo-text-gray-600 plasmo-transition-colors">
                                <X size={20} />
                            </motion.button>

                            {/* 标题区 */}
                            <div className="plasmo-mb-8">
                                <div className="plasmo-flex plasmo-items-center plasmo-gap-3 plasmo-mb-4">
                                    <div className="plasmo-p-2 plasmo-bg-gradient-to-br plasmo-from-pink-50 plasmo-to-pink-100 plasmo-rounded-xl plasmo-shadow-sm">
                                        <MessageSquare size={20} className="plasmo-text-bili-pink" />
                                    </div>
                                    <h2 className="plasmo-text-xl plasmo-font-black plasmo-text-gray-900">备份管理器</h2>
                                </div>
                                <p className="plasmo-text-gray-500 plasmo-text-sm">正在处理与 UID <span className="plasmo-text-bili-pink plasmo-font-mono plasmo-bg-pink-50 plasmo-px-1.5 plasmo-py-0.5 plasmo-rounded">{talkerId}</span> 的数据历史</p>
                                {exportConfig.titleFormat === "custom" && (
                                    <p className="plasmo-text-xs plasmo-text-gray-400 plasmo-mt-1">自定义标题: {exportConfig.customTitle}</p>
                                )}
                            </div>

                            {/* 导出中 / 按钮区 */}
                            <AnimatePresence mode="wait">
                                {isExporting ? (
                                    <motion.div key="loading" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="plasmo-py-10 plasmo-text-center plasmo-space-y-4">
                                        <div className="plasmo-relative plasmo-inline-block">
                                            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }} className="plasmo-w-20 plasmo-h-20 plasmo-border-4 plasmo-border-pink-100 plasmo-border-t-bili-pink plasmo-rounded-full" />
                                            <div className="plasmo-absolute plasmo-inset-0 plasmo-flex plasmo-items-center plasmo-justify-center plasmo-font-black plasmo-text-gray-700 plasmo-text-lg">{messages.length}</div>
                                        </div>
                                        <motion.p key={progressText} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="plasmo-text-xs plasmo-text-gray-400">{progressText}</motion.p>
                                    </motion.div>
                                ) : (
                                    <motion.div key="buttons" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="plasmo-grid plasmo-grid-cols-2 plasmo-gap-4">
                                        <motion.button whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.97 }} onClick={handlePDFExport} className="plasmo-flex plasmo-flex-col plasmo-items-center plasmo-gap-3 plasmo-p-5 plasmo-bg-gradient-to-br plasmo-from-pink-50 plasmo-to-pink-100/50 plasmo-border plasmo-border-pink-200 plasmo-rounded-2xl hover:plasmo-shadow-md plasmo-transition-all plasmo-group">
                                            <div className="plasmo-p-2 plasmo-bg-white plasmo-rounded-xl plasmo-shadow-sm">
                                                <FileText size={20} className="plasmo-text-bili-pink group-hover:plasmo-scale-110 plasmo-transition-transform" />
                                            </div>
                                            <span className="plasmo-font-bold plasmo-text-gray-800 plasmo-text-sm">导出 PDF</span>
                                        </motion.button>
                                        <motion.button whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.97 }} onClick={handleJSONExport} className="plasmo-flex plasmo-flex-col plasmo-items-center plasmo-gap-3 plasmo-p-5 plasmo-bg-gradient-to-br plasmo-from-blue-50 plasmo-to-blue-100/50 plasmo-border plasmo-border-blue-200 plasmo-rounded-2xl hover:plasmo-shadow-md plasmo-transition-all plasmo-group">
                                            <div className="plasmo-p-2 plasmo-bg-white plasmo-rounded-xl plasmo-shadow-sm">
                                                <FileJson size={20} className="plasmo-text-bili-blue group-hover:plasmo-scale-110 plasmo-transition-transform" />
                                            </div>
                                            <span className="plasmo-font-bold plasmo-text-gray-800 plasmo-text-sm">导出 JSON</span>
                                        </motion.button>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* 底部 */}
                            <div className="plasmo-mt-8 plasmo-pt-6 plasmo-border-t plasmo-border-gray-100 plasmo-flex plasmo-justify-center">
                                <p className="plasmo-text-[10px] plasmo-text-gray-300">Bili Chat Exporter v0.1.0beta</p>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

export default BiliChatExporterUI
