/**
 * PDF 导出引擎 (v3)
 * html2canvas 全量渲染 + Canvas 切片分页
 * 性能：500 条消息约 2s
 */

import jsPDF from "jspdf"
import html2canvas from "html2canvas"
import { getBase64Image } from "../api"
import { parseMessageContent } from "../parser"
import { TitleFormat, type ExportConfig } from "../storage"
import type { BiliMsg } from "../../types/message"

// 页面尺寸常量
const A4_W = 210
const A4_H = 297
const MARGIN = 12
const CONTENT_W_MM = A4_W - MARGIN * 2
const CONTENT_W_PX = 704
const SCALE = 2
const PAGE_H_PX = 1032
const CHUNK_PAGES = 15

const FONT = '-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei","Hiragino Sans GB","Helvetica Neue",Arial,sans-serif'
const BILI_PINK = "#fb7299"
const BILI_BLUE = "#00a1d6"

// 各类分享卡片的配色和标签
const CARD_STYLES: Record<string, { accent: string; label: string }> = {
    video:       { accent: BILI_PINK,  label: "视频" },
    short_video: { accent: BILI_PINK,  label: "小视频" },
    article:     { accent: BILI_BLUE,  label: "专栏文章" },
    anime:       { accent: "#e67e22",  label: "番剧" },
    audio:       { accent: "#9b59b6",  label: "音频分享" },
    playlist:    { accent: "#3498db",  label: "歌单分享" },
    live:        { accent: "#e74c3c",  label: "直播间" },
    manga:       { accent: "#1abc9c",  label: "漫画分享" },
    outfit:      { accent: "#e91e63",  label: "装扮分享" },
    album:       { accent: "#2ecc71",  label: "相簿分享" },
    event:       { accent: "#f39c12",  label: "活动分享" },
    default:     { accent: "#95a5a6",  label: "分享" },
}

interface ParsedMsg {
    msg: BiliMsg
    parsed: ReturnType<typeof parseMessageContent> & { revoked?: boolean }
}

interface PageSpec {
    msgs: ParsedMsg[]
    pageNum: number
    totalPages: number
}

// 工具函数
const isRevoked = (m: BiliMsg) => m.msg_status === 1 || m.msg_status === 2
const isRevNotice = (m: BiliMsg) => m.msg_type === 5
const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

function esc(s: string): string {
    const d = document.createElement("div"); d.textContent = s; return d.innerHTML
}
function escAttr(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}
function dateLabel(ts: number): string {
    const d = new Date(ts * 1000)
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}
function timeStr(ts: number): string {
    return new Date(ts * 1000).toLocaleString("zh-CN", { hour12: false })
}

// 将文本中的 [表情] 替换为内联 <img>
function emotes(raw: string, map: Record<string, string>): string {
    if (!raw) return ""
    const parts: string[] = []
    let last = 0
    const re = /\[(.+?)\]/g
    let m: RegExpExecArray | null
    while ((m = re.exec(raw)) !== null) {
        if (m.index > last) parts.push(esc(raw.slice(last, m.index)))
        const url = map[m[0]]
        parts.push(url ? `<img class="pe" src="${escAttr(url)}" alt="${esc(m[0])}">` : esc(m[0]))
        last = re.lastIndex
    }
    if (last < raw.length) parts.push(esc(raw.slice(last)))
    return parts.join("")
}

// 页面 CSS
function css(): string {
    return `
*{margin:0;padding:0;box-sizing:border-box}
body{background:#fff}
.ppg{width:${CONTENT_W_PX}px;height:${PAGE_H_PX}px;padding:24px 32px 0;font-family:${FONT};color:#18191c;background:#fff;position:relative;overflow:hidden}
.ppg.has-footer{padding-bottom:62px}
.ph-h1{font-size:21px;font-weight:700;color:#1a1a1a;line-height:1.3}
.ph-sub{font-size:11px;color:#999;margin-top:2px}
.ph-line{height:2px;background:${BILI_PINK};margin:10px 0 0;opacity:.7}
.pch{padding:2px 0 6px}
.pch-t{font-size:10px;color:#bbb;text-align:center}
.pds{display:flex;justify-content:center;margin:14px 0 10px}
.pds span{font-size:11px;color:#aaa;background:#f7f7f7;padding:3px 12px;border-radius:10px}
.pm{display:flex;flex-direction:column;margin-bottom:8px}
.pm.sent{align-items:flex-end}
.pm.recv{align-items:flex-start}
.pm-time{font-size:10px;color:#bbb;margin-bottom:2px;padding:0 2px}
.pb{max-width:75%;padding:10px 14px;border-radius:14px;font-size:14px;line-height:1.65;word-break:break-word;white-space:pre-wrap}
.sent .pb{background:${BILI_PINK};color:#fff;border-bottom-right-radius:4px}
.recv .pb{background:#f4f5f7;color:#18191c;border-bottom-left-radius:4px}
.pb.revoked{background:#e8e8e8!important;color:#aaa!important}
.pe{width:22px;height:22px;vertical-align:text-bottom;margin:0 2px;display:inline-block}
.pi img{max-width:280px;max-height:400px;border-radius:8px;display:block;border:1px solid #eee}
.ps{display:flex;flex-direction:column;align-items:center;margin-bottom:10px}
.ps-b{font-size:12px;color:#9499a0;background:#f5f5f5;padding:6px 16px;border-radius:16px;max-width:90%;text-align:center;line-height:1.5;word-break:break-word}
.pc{max-width:380px;background:#fafafa;border:1px solid #e8e8e8;border-radius:10px;overflow:hidden}
.pc-inner{display:flex;padding:12px;gap:12px}
.pc-cover{width:112px;height:70px;border-radius:6px;object-fit:cover;flex-shrink:0;background:#eee}
.pc-icon{width:40px;height:40px;border-radius:6px;object-fit:cover;flex-shrink:0;background:#eee}
.pc-body{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center}
.pc-label{font-size:10px;font-weight:600;margin-bottom:3px}
.pc-title{font-size:13px;font-weight:600;color:#333;line-height:1.4;margin-bottom:2px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.pc-desc{font-size:11px;color:#888;line-height:1.4;margin-bottom:2px;display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden}
.pc-meta{font-size:10px;color:#aaa}
.pc-link{font-size:10px;color:${BILI_BLUE};margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pf{position:absolute;bottom:12px;left:32px;right:32px;text-align:center;font-size:10px;color:#d0d0d0;padding-top:10px;border-top:1px solid #f0f0f0;background:#fff}
.pf-end{font-size:11px;color:#ccc;text-align:center;padding:12px 0 4px}
.prv-b{font-size:12px;color:#bbb;background:#f5f5f5;padding:5px 14px;border-radius:16px}
`
}

// HTML 片段构建
function hdr(title: string, showTime: boolean): string {
    let s = '<div class="ph-h1">' + esc(title) + "</div>"
    if (showTime) s += '<div class="ph-sub">导出于 ' + esc(timeStr(Date.now() / 1000)) + "</div>"
    return s + '<div class="ph-line"></div>'
}
function hdrCont(): string {
    return '<div class="pch"><div class="pch-t">-- 对话记录（续） --</div></div>'
}
function dateSep(label: string): string {
    return '<div class="pds"><span>' + esc(label) + "</span></div>"
}
function footer(n: number, total: number, isLast: boolean, showNums: boolean): string {
    if (!showNums && !isLast) return ""
    let s = ""
    if (showNums) s += '<div class="pf">第 ' + n + " / " + total + " 页</div>"
    if (isLast) s += '<div class="pf-end"' + (showNums ? "" : ' style="margin-top:20px"') + ">-- Bili Chat Exporter --</div>"
    return s
}

// 各类型消息的 HTML 卡片
function textBubble(text: string, isMe: boolean, revoked: boolean, time: string, showTime: boolean, em: Record<string, string>): string {
    return '<div class="pm ' + (isMe ? "sent" : "recv") + '">' +
        (showTime ? '<div class="pm-time">' + esc(time) + "</div>" : "") +
        '<div class="pb' + (revoked ? " revoked" : "") + '">' + emotes(text, em) + "</div></div>"
}

function revokedPlaceholder(time: string, showTime: boolean): string {
    return '<div class="ps">' + (showTime ? '<div class="pm-time" style="margin-bottom:4px">' + esc(time) + "</div>" : "") +
        '<div class="prv-b">[消息已撤回]</div></div>'
}

function imgMsg(b64: string, isMe: boolean, time: string, showTime: boolean): string {
    return '<div class="pm ' + (isMe ? "sent" : "recv") + '">' +
        (showTime ? '<div class="pm-time">' + esc(time) + "</div>" : "") +
        '<div class="pi"><img src="' + escAttr(b64) + '" alt="图片"></div></div>'
}

function sysMsg(text: string, showTime: boolean, time: string): string {
    return '<div class="ps">' + (showTime ? '<div class="pm-time" style="margin-bottom:2px">' + esc(time) + "</div>" : "") +
        '<div class="ps-b">' + esc(text) + "</div></div>"
}

function videoCard(parsed: ParsedMsg["parsed"], isMe: boolean, time: string, showTime: boolean, cs: { accent: string; label: string }): string {
    const lines = parsed.text.split("\n")
    const title = lines[0].replace(/^\[.*?\]\s*/, "")
    let desc = "", meta = ""
    for (let i = 1; i < lines.length; i++) {
        const l = lines[i].trim()
        if (!l) continue
        if (/^(播放|弹幕|追番|观看)：/.test(l)) meta += (meta ? " · " : "") + l
        else desc = l
    }
    return '<div class="pm ' + (isMe ? "sent" : "recv") + '">' +
        (showTime ? '<div class="pm-time">' + esc(time) + "</div>" : "") +
        '<div class="pc" style="border-left:3px solid ' + cs.accent + '"><div class="pc-inner">' +
        (parsed.image ? '<img class="pc-cover" src="' + escAttr(parsed.image) + '" alt="">' : "") +
        '<div class="pc-body">' +
        '<div class="pc-label" style="color:' + cs.accent + '">' + esc(cs.label) + "</div>" +
        (title ? '<div class="pc-title">' + esc(title) + "</div>" : "") +
        (desc ? '<div class="pc-desc">' + esc(desc) + "</div>" : "") +
        (meta ? '<div class="pc-meta">' + esc(meta) + "</div>" : "") +
        (parsed.url ? '<div class="pc-link">' + esc(parsed.url) + "</div>" : "") +
        "</div></div></div></div>"
}

function articleCard(parsed: ParsedMsg["parsed"], isMe: boolean, time: string, showTime: boolean): string {
    const title = parsed.text.replace(/^\[专栏\]\s*/, "")
    const cs = CARD_STYLES["article"]
    return '<div class="pm ' + (isMe ? "sent" : "recv") + '">' +
        (showTime ? '<div class="pm-time">' + esc(time) + "</div>" : "") +
        '<div class="pc" style="border-left:3px solid ' + cs.accent + '"><div class="pc-inner">' +
        (parsed.image ? '<img class="pc-icon" src="' + escAttr(parsed.image) + '" alt="">' : "") +
        '<div class="pc-body"><div class="pc-label" style="color:' + cs.accent + '">' + esc(cs.label) + "</div>" +
        (title ? '<div class="pc-title">' + esc(title) + "</div>" : "") +
        "</div></div></div></div>"
}

function shareCard(parsed: ParsedMsg["parsed"], isMe: boolean, time: string, showTime: boolean, stype: string): string {
    const m = parsed.text.match(/^\[(.+?)\]\s*(.*)/)
    const raw = m ? m[2] : parsed.text
    const lines = raw.split("\n")
    const cs = CARD_STYLES[stype] || CARD_STYLES["default"]
    return '<div class="pm ' + (isMe ? "sent" : "recv") + '">' +
        (showTime ? '<div class="pm-time">' + esc(time) + "</div>" : "") +
        '<div class="pc" style="border-left:3px solid ' + cs.accent + '"><div class="pc-inner">' +
        (parsed.image ? '<img class="pc-icon" src="' + escAttr(parsed.image) + '" alt="">' : "") +
        '<div class="pc-body"><div class="pc-label" style="color:' + cs.accent + '">' + esc(cs.label) + "</div>" +
        (lines[0] ? '<div class="pc-title">' + esc(lines[0]) + "</div>" : "") +
        (lines[1] ? '<div class="pc-desc">' + esc(lines.slice(1).join(" ")) + "</div>" : "") +
        (parsed.url ? '<div class="pc-link">' + esc(parsed.url) + "</div>" : "") +
        "</div></div></div></div>"
}

// 根据消息类型生成对应 HTML
function msgHTML(pm: ParsedMsg, talkerId: string, cfg: ExportConfig, em: Record<string, string>): string {
    const { msg, parsed } = pm
    const isMe = msg.sender_uid !== parseInt(talkerId)
    const time = timeStr(msg.timestamp)
    const st = cfg.showMessageTime

    if (isRevNotice(msg) && !parsed.revoked) return sysMsg("[对方撤回了一条消息]", st, time)
    if (parsed.revoked) return cfg.showRevokedContent ? textBubble(parsed.text, isMe, true, time, st, em) : revokedPlaceholder(time, st)
    if (parsed.type_info === "system") return sysMsg(parsed.text, st, time)
    if (parsed.type_info === "image" && parsed.image) return imgMsg(parsed.image, isMe, time, st)
    if (parsed.type_info === "video") return videoCard(parsed, isMe, time, st, CARD_STYLES[cardKey(msg)])
    if (parsed.type_info === "article") return articleCard(parsed, isMe, time, st)
    if (parsed.type_info === "share") {
        const typeMap: Record<number, string> = { 25: "audio", 26: "playlist", 27: "live", 29: "manga", 30: "outfit", 32: "album", 33: "event" }
        return shareCard(parsed, isMe, time, st, typeMap[msg.msg_type] || "default")
    }
    return textBubble(parsed.text, isMe, false, time, st, em)
}

function cardKey(msg: BiliMsg): string {
    if (msg.msg_type === 28) return "anime"
    if (msg.msg_type === 31) return "short_video"
    return "video"
}

// 图片预加载：6 路并发转 Base64
async function loadImages(msgs: BiliMsg[], cb?: (s: string) => void): Promise<ParsedMsg[]> {
    const filtered = msgs.filter(m => !(isRevNotice(m) && !isRevoked(m)))
    const list: ParsedMsg[] = filtered.map(msg => ({
        msg,
        parsed: { ...parseMessageContent(msg.content, msg.msg_type), revoked: isRevoked(msg) || undefined },
    }))
    const imgs = list.filter(p => p.parsed.image)
    const total = imgs.length
    if (total > 0) {
        cb?.("正在预加载图片 (0%)...")
        let done = 0
        for (let i = 0; i < imgs.length; i += 6) {
            await Promise.all(imgs.slice(i, i + 6).map(async pm => {
                if (!pm.parsed.image) return
                try { pm.parsed.image = await getBase64Image(pm.parsed.image.replace(/@\d+w_\d+h.*$/, "")) }
                catch { pm.parsed.image = "" }
                done++
            }))
            cb?.(`正在加载图片 (${Math.round((done / total) * 100)}%)...`)
            await wait(0)
        }
    }
    return list.reverse()
}

// 创建离屏容器用于 DOM 测量
function mkDiv(visible = false): HTMLDivElement {
    const d = document.createElement("div")
    d.style.cssText = `position:fixed;left:-9999px;top:0;width:${CONTENT_W_PX}px;${visible ? "" : "visibility:hidden;"}pointer-events:none`
    document.body.appendChild(d)
    return d
}

// 智能分页：一次性构建 DOM 测量每条消息高度
async function paginate(
    msgs: ParsedMsg[], title: string, cfg: ExportConfig,
    em: Record<string, string>, talkerId: string
): Promise<PageSpec[]> {
    const ct = mkDiv()

    // 测量首页 header 高度
    ct.innerHTML = `<style>${css()}</style><div class="ppg"><div id="hdr-wrap">${hdr(title, cfg.showExportTime)}</div></div>`
    await wait(50)
    const headerH = ct.querySelector("#hdr-wrap")!.getBoundingClientRect().height

    // 测量续页 header 高度
    let contH = 0
    if (cfg.showContinuationHeader) {
        ct.innerHTML = `<style>${css()}</style><div class="ppg"><div id="chdr-wrap">${hdrCont()}</div></div>`
        await wait(30)
        contH = ct.querySelector("#chdr-wrap")!.getBoundingClientRect().height
    }

    // 测量 footer 高度
    let footerH = 0
    if (cfg.showPageNumbers) {
        ct.innerHTML = `<style>${css()}</style><div class="ppg has-footer">${footer(1, 1, false, true)}</div>`
        await wait(30)
        const pf = ct.querySelector(".pf") as HTMLElement
        if (pf) footerH = pf.getBoundingClientRect().height + 12
    }

    const footerReserve = cfg.showPageNumbers ? footerH + 16 : 6
    const safety = 28

    // 构建全量消息 HTML 并测量
    let all = `<style>${css()}</style><div class="ppg" id="meas">`
    all += `<div id="hdr-place">${hdr(title, cfg.showExportTime)}</div>`
    let lastDate = ""
    for (let i = 0; i < msgs.length; i++) {
        const md = dateLabel(msgs[i].msg.timestamp)
        if (md !== lastDate) { all += dateSep(md); lastDate = md }
        all += msgHTML(msgs[i], talkerId, cfg, em).replace(/^<(\w+)/, `<$1 data-mi="${i}"`)
    }
    all += "</div>"
    ct.innerHTML = all
    await wait(100)

    // 按可用高度切分页面
    const contentBottom = PAGE_H_PX - footerReserve - safety
    const TOP_PAD = 24
    const page1Avail = contentBottom - TOP_PAD - headerH
    const pageNAvail = contentBottom - TOP_PAD - contH
    const markers = Array.from(ct.querySelectorAll("[data-mi]")) as HTMLElement[]
    const containerTop = (ct.querySelector("#meas") as HTMLElement)?.getBoundingClientRect().top ?? 0
    const pages: PageSpec[] = []
    let pageMsgs: ParsedMsg[] = []
    let pageTop = containerTop > 0 ? markers[0]?.getBoundingClientRect().top - containerTop : (markers[0]?.offsetTop ?? TOP_PAD + headerH)
    let firstPage = true

    for (const el of markers) {
        const idx = parseInt(el.getAttribute("data-mi")!)
        const cs = window.getComputedStyle(el)
        const mb = parseFloat(cs.marginBottom) || 0
        const bottom = (el.getBoundingClientRect().top - containerTop) + el.getBoundingClientRect().height + mb
        const avail = firstPage ? page1Avail : pageNAvail

        if (bottom - pageTop > avail && pageMsgs.length > 0) {
            pages.push({ msgs: pageMsgs, pageNum: pages.length + 1, totalPages: 0 })
            pageMsgs = [msgs[idx]]
            pageTop = el.getBoundingClientRect().top - containerTop
            firstPage = false
        } else {
            pageMsgs.push(msgs[idx])
        }
    }
    if (pageMsgs.length > 0) pages.push({ msgs: pageMsgs, pageNum: pages.length + 1, totalPages: 0 })

    const total = pages.length
    pages.forEach(p => p.totalPages = total)
    document.body.removeChild(ct)
    return pages
}

// 渲染一个 chunk 的页面，返回 Canvas 数组
async function renderChunk(
    chunk: PageSpec[], title: string, cfg: ExportConfig,
    em: Record<string, string>, talkerId: string
): Promise<HTMLCanvasElement[]> {
    const ct = mkDiv(true)

    let htm = `<style>${css()}</style>`
    let lastDate = ""
    for (const pg of chunk) {
        htm += `<div class="${cfg.showPageNumbers ? "ppg has-footer" : "ppg"}">`
        if (pg.pageNum === 1) htm += hdr(title, cfg.showExportTime)
        else if (cfg.showContinuationHeader) htm += hdrCont()

        for (const pm of pg.msgs) {
            const md = dateLabel(pm.msg.timestamp)
            if (md !== lastDate) { htm += dateSep(md); lastDate = md }
            htm += msgHTML(pm, talkerId, cfg, em)
        }
        htm += footer(pg.pageNum, pg.totalPages, pg.pageNum === pg.totalPages, cfg.showPageNumbers)
        htm += "</div>"
    }
    ct.innerHTML = htm
    await wait(80)

    // 记录每页实际高度
    const ppgEls = Array.from(ct.querySelectorAll(".ppg")) as HTMLElement[]
    const heights = ppgEls.map(el => Math.ceil(el.offsetHeight * SCALE))
    const totalH = heights.reduce((a, b) => a + b, 0)

    // 一次性 html2canvas 渲染
    const big = await html2canvas(ct, { scale: SCALE, useCORS: true, allowTaint: true, backgroundColor: "#fff", logging: false })
    document.body.removeChild(ct)

    // 按高度切片
    const dpW = CONTENT_W_PX * SCALE
    const pages: HTMLCanvasElement[] = []
    let sy = 0
    for (let i = 0; i < heights.length; i++) {
        const sh = Math.min(heights[i], big.height - sy)
        if (sh <= 0) break
        const pc = document.createElement("canvas")
        pc.width = dpW; pc.height = sh
        const ctx = pc.getContext("2d")!
        ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, dpW, sh)
        ctx.drawImage(big, 0, sy, dpW, sh, 0, 0, dpW, sh)
        pages.push(pc)
        sy += sh
    }
    big.width = 0; big.height = 0
    return pages
}

// 生成标题
function makeTitle(id: string, name: string, cfg: ExportConfig): string {
    if (cfg.titleFormat === TitleFormat.USERNAME) return `与 ${name} 的对话记录`
    if (cfg.titleFormat === TitleFormat.CUSTOM) return cfg.customTitle || `Bilibili 私信存档 / UID: ${id}`
    return `Bilibili 私信存档 / UID: ${id}`
}

function makeFileName(name: string, id: string): string {
    return `BiliChat_${(name || id).replace(/[\\/:*?"<>|]/g, "_")}_${new Date().toISOString().split("T")[0]}.pdf`
}

// 主入口：图片预载 -> 分页 -> chunk 渲染 -> PDF 组装
export async function exportToPDF(
    talkerId: string, messages: BiliMsg[], config: ExportConfig,
    talkerName: string, emoteMap: Record<string, string>,
    onProgress?: (status: string) => void
): Promise<void> {
    try {
        const parsed = await loadImages(messages, onProgress)
        if (!parsed.length) throw new Error("没有可导出的消息")
        const title = makeTitle(talkerId, talkerName, config)

        onProgress?.("正在智能排版...")
        const pages = await paginate(parsed, title, config, emoteMap, talkerId)
        if (!pages.length) throw new Error("排版失败")

        const pdf = new jsPDF("p", "mm", "a4")
        let firstPage = true

        for (let ci = 0; ci < pages.length; ci += CHUNK_PAGES) {
            const chunk = pages.slice(ci, ci + CHUNK_PAGES)
            onProgress?.(`正在生成 PDF... ${Math.round((ci / pages.length) * 100)}%`)

            const canvases = await renderChunk(chunk, title, config, emoteMap, talkerId)
            for (const cv of canvases) {
                if (!firstPage) pdf.addPage()
                firstPage = false
                const cw = cv.width / SCALE
                const wMM = (cw / CONTENT_W_PX) * CONTENT_W_MM
                const hMM = (cv.height / SCALE / cw) * CONTENT_W_MM
                pdf.addImage(cv.toDataURL("image/jpeg", 0.92), "JPEG", MARGIN, MARGIN, wMM, hMM)
                cv.width = 0; cv.height = 0
            }
            await wait(0)
        }

        onProgress?.("导出完成！共 " + pages.length + " 页")
        pdf.save(makeFileName(talkerName, talkerId))
    } catch (e) {
        throw new Error(`PDF 导出失败: ${e instanceof Error ? e.message : "未知错误"}`)
    }
}
