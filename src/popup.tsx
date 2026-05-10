import { useStorage } from "@plasmohq/storage/hook"
import { Download, ExternalLink, Github, MessageCircle, FileText, CheckCircle2, Sparkles } from "lucide-react"
import { useState } from "react"
import { DEFAULT_CONFIG, STORAGE_KEYS, TitleFormat, type ExportConfig } from "./core/storage"
import { motion, AnimatePresence } from "framer-motion"
import "./style.css"

// 扩展弹窗：使用指南 + 高级设置
const IndexPopup = () => {
    const [config, setConfig] = useStorage<ExportConfig>(STORAGE_KEYS.CONFIG, DEFAULT_CONFIG)
    const [activeTab, setActiveTab] = useState<"guide" | "settings">("guide")

    if (!config) return (
        <div className="plasmo-w-[340px] plasmo-h-[400px] plasmo-flex plasmo-items-center plasmo-justify-center plasmo-bg-white">
            <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                className="plasmo-w-8 plasmo-h-8 plasmo-border-2 plasmo-border-pink-200 plasmo-border-t-bili-pink plasmo-rounded-full"
            />
        </div>
    )

    const update = (key: keyof ExportConfig, value: any) => setConfig({ ...config, [key]: value })

    return (
        <div className="plasmo-w-[340px] plasmo-bg-white plasmo-min-h-[400px] plasmo-flex plasmo-flex-col">
            {/* 顶部标题 */}
            <div className="plasmo-p-5 plasmo-pb-0">
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="plasmo-flex plasmo-items-center plasmo-gap-3 plasmo-mb-6">
                    <div className="plasmo-w-10 plasmo-h-10 plasmo-bg-gradient-to-br plasmo-from-pink-50 plasmo-to-pink-100 plasmo-rounded-xl plasmo-flex plasmo-items-center plasmo-justify-center plasmo-shadow-sm">
                        <Download className="plasmo-text-bili-pink" size={20} />
                    </div>
                    <div>
                        <h1 className="plasmo-text-lg plasmo-font-black plasmo-text-gray-900">Bili Chat Exporter</h1>
                        <p className="plasmo-text-[10px] plasmo-text-gray-400 plasmo-font-bold plasmo-tracking-widest plasmo-uppercase">v0.1.0beta</p>
                    </div>
                </motion.div>

                {/* 标签页切换 */}
                <div className="plasmo-flex plasmo-bg-gray-100 plasmo-p-1 plasmo-rounded-xl plasmo-mb-4">
                    {[
                        { id: "guide" as const, label: "使用指南", icon: Sparkles },
                        { id: "settings" as const, label: "高级设置", icon: FileText }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`plasmo-flex-1 plasmo-py-2 plasmo-text-xs plasmo-font-bold plasmo-rounded-lg plasmo-transition-all plasmo-flex plasmo-items-center plasmo-justify-center plasmo-gap-1.5 ${activeTab === tab.id ? "plasmo-bg-white plasmo-text-bili-pink plasmo-shadow-sm" : "plasmo-text-gray-500 hover:plasmo-text-gray-700"}`}
                        >
                            <tab.icon size={14} />
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* 内容区域 */}
            <div className="plasmo-flex-1 plasmo-p-5 plasmo-pt-0 plasmo-overflow-y-auto">
                <AnimatePresence mode="wait">
                    {activeTab === "guide" ? (
                        <motion.div key="guide" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="plasmo-space-y-4">
                            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }} className="plasmo-bg-gradient-to-br plasmo-from-pink-50 plasmo-to-pink-50/50 plasmo-p-4 plasmo-rounded-2xl plasmo-border plasmo-border-pink-100">
                                <p className="plasmo-text-sm plasmo-text-pink-700 plasmo-leading-relaxed">
                                    <strong>使用方法</strong>：进入 B 站私信详情页，点击右上角的「导出此对话」按钮即可开始。
                                </p>
                            </motion.div>
                            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => window.open("https://message.bilibili.com/", "_blank")} className="plasmo-w-full plasmo-flex plasmo-items-center plasmo-justify-between plasmo-p-4 plasmo-bg-gradient-to-r plasmo-from-bili-pink plasmo-to-pink-500 plasmo-text-white plasmo-rounded-2xl plasmo-font-bold plasmo-shadow-md plasmo-shadow-pink-200 plasmo-transition-all">
                                <div className="plasmo-flex plasmo-items-center plasmo-gap-3">
                                    <MessageCircle size={18} />
                                    <span>进入私信页面</span>
                                </div>
                                <ExternalLink size={16} />
                            </motion.button>
                            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="plasmo-w-full plasmo-flex plasmo-items-center plasmo-justify-center plasmo-gap-2 plasmo-p-3 plasmo-bg-gray-50 plasmo-text-gray-600 plasmo-rounded-xl plasmo-text-xs plasmo-font-bold hover:plasmo-bg-gray-100 plasmo-transition-all plasmo-border plasmo-border-gray-100">
                                <Github size={14} />
                                <span>GitHub 仓库</span>
                            </motion.button>
                        </motion.div>
                    ) : (
                        <motion.div key="settings" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="plasmo-space-y-5">
                            {/* PDF 标题格式 */}
                            <div className="plasmo-space-y-3">
                                <div className="plasmo-flex plasmo-items-center plasmo-gap-2 plasmo-text-gray-700 plasmo-font-bold plasmo-text-sm">
                                    <FileText size={16} className="plasmo-text-bili-pink" />
                                    <span>PDF 标题格式</span>
                                </div>
                                <div className="plasmo-grid plasmo-grid-cols-1 plasmo-gap-2">
                                    {[
                                        { label: "使用对方 UID", value: TitleFormat.UID },
                                        { label: "使用对方昵称", value: TitleFormat.USERNAME },
                                        { label: "自定义标题", value: TitleFormat.CUSTOM }
                                    ].map((opt, i) => (
                                        <motion.label key={opt.value} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className={`plasmo-flex plasmo-items-center plasmo-justify-between plasmo-p-3 plasmo-rounded-xl plasmo-border plasmo-cursor-pointer plasmo-transition-all ${config.titleFormat === opt.value ? "plasmo-border-bili-pink plasmo-bg-pink-50/50 plasmo-shadow-sm" : "plasmo-border-gray-100 hover:plasmo-bg-gray-50"}`}>
                                            <span className="plasmo-text-xs plasmo-font-medium plasmo-text-gray-700">{opt.label}</span>
                                            <div className="plasmo-relative plasmo-flex plasmo-items-center">
                                                <input type="radio" name="titleFormat" value={opt.value} checked={config.titleFormat === opt.value} onChange={() => update("titleFormat", opt.value)} className="plasmo-peer plasmo-appearance-none plasmo-w-4 plasmo-h-4 plasmo-border-2 plasmo-border-gray-300 plasmo-rounded-full checked:plasmo-border-bili-pink checked:plasmo-bg-bili-pink plasmo-transition-all" />
                                                <div className="plasmo-absolute plasmo-inset-0 plasmo-text-white plasmo-opacity-0 peer-checked:plasmo-opacity-100 plasmo-pointer-events-none plasmo-flex plasmo-items-center plasmo-justify-center">
                                                    <CheckCircle2 size={10} />
                                                </div>
                                            </div>
                                        </motion.label>
                                    ))}
                                </div>
                                <AnimatePresence>
                                    {config.titleFormat === TitleFormat.CUSTOM && (
                                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }}>
                                            <input type="text" value={config.customTitle} onChange={e => update("customTitle", e.target.value)} placeholder="请输入自定义标题..." className="plasmo-w-full plasmo-p-3 plasmo-text-xs plasmo-border plasmo-border-gray-200 plasmo-rounded-xl focus:plasmo-outline-none focus:plasmo-border-bili-pink focus:plasmo-ring-2 focus:plasmo-ring-pink-100 plasmo-transition-all" />
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            {/* 开关选项 */}
                            <div className="plasmo-space-y-3 plasmo-pt-4 plasmo-border-t plasmo-border-gray-100">
                                {[
                                    { key: "showExportTime" as const, label: "显示导出时间" },
                                    { key: "showMessageTime" as const, label: "显示每条消息时间" },
                                    { key: "showRevokedContent" as const, label: "显示撤回消息内容" },
                                    { key: "showContinuationHeader" as const, label: "显示续页标题" },
                                    { key: "showPageNumbers" as const, label: "显示页码" },
                                ].map((item, i) => (
                                    <motion.label key={item.key} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.05 }} className="plasmo-flex plasmo-items-center plasmo-justify-between plasmo-cursor-pointer plasmo-p-2 plasmo-rounded-lg hover:plasmo-bg-gray-50 plasmo-transition-all">
                                        <span className="plasmo-text-xs plasmo-font-medium plasmo-text-gray-600">{item.label}</span>
                                        <div className="plasmo-relative">
                                            <input type="checkbox" checked={config[item.key]} onChange={e => update(item.key, e.target.checked)} className="plasmo-sr-only plasmo-peer" />
                                            <div className="plasmo-w-9 plasmo-h-5 plasmo-bg-gray-200 plasmo-rounded-full peer-checked:plasmo-bg-bili-pink plasmo-transition-colors plasmo-cursor-pointer" />
                                            <div className="plasmo-absolute plasmo-top-0.5 plasmo-left-0.5 plasmo-w-4 plasmo-h-4 plasmo-bg-white plasmo-rounded-full plasmo-shadow-sm plasmo-transition-transform peer-checked:plasmo-translate-x-4" />
                                        </div>
                                    </motion.label>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* 底部 */}
            <div className="plasmo-p-3 plasmo-border-t plasmo-border-gray-100 plasmo-text-center">
                <p className="plasmo-text-[10px] plasmo-text-gray-300">Bili Chat Exporter</p>
            </div>
        </div>
    )
}

export default IndexPopup
