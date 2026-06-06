/**
 * HTML 导出引擎
 * 生成单文件 HTML，内嵌 Base64 图片/表情，支持搜索与复制，保留精美 Web UI
 */

import type { BiliMsg } from "../../types/message"
import { parseMessageContent } from "../parser"
import { TitleFormat, type ExportConfig } from "../storage"
import { getBase64Image, getUserInfo } from "../api"

interface ParsedMsg {
    msg: BiliMsg
    parsed: ReturnType<typeof parseMessageContent>
    isMe: boolean
    timeStr: string
    dateLabel: string
}

// 缓存 base64 数据避免重复加载
const base64Cache: Record<string, string> = {}

async function getCachedBase64(url: string): Promise<string> {
    if (!url) return ""
    // 去除 B 站图片的裁剪参数以获取原图
    const cleanUrl = url.replace(/@\d+w_\d+h.*$/, "")
    if (base64Cache[cleanUrl]) return base64Cache[cleanUrl]
    try {
        const b64 = await getBase64Image(cleanUrl)
        base64Cache[cleanUrl] = b64
        return b64
    } catch {
        return url
    }
}

// 格式化时间
function formatDateTime(ts: number): string {
    return new Date(ts * 1000).toLocaleString("zh-CN", { hour12: false })
}

function formatDateLabel(ts: number): string {
    const d = new Date(ts * 1000)
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}

// 转义 HTML 防止注入
function esc(s: string): string {
    const d = document.createElement("div")
    d.textContent = s
    return d.innerHTML
}

function escAttr(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

// 表情替换为 Base64 内联图片
function replaceEmotes(text: string, emoteMap: Record<string, string>): string {
    if (!text) return ""
    return text.replace(/\[(.+?)\]/g, match => {
        const b64 = emoteMap[match]
        return b64 ? `<img class="emote-img" src="${escAttr(b64)}" alt="${esc(match)}" />` : esc(match)
    })
}

// 获取用户头像和名字
async function getChatUsers(talkerId: string, messages: BiliMsg[], talkerName: string) {
    let selfId = ""
    for (const m of messages) {
        if (m.sender_uid.toString() !== talkerId) {
            selfId = m.sender_uid.toString()
            break
        }
    }

    const [talkerInfo, selfInfo] = await Promise.all([
        getUserInfo(talkerId),
        selfId ? getUserInfo(selfId) : Promise.resolve(null)
    ])

    return {
        talker: {
            name: talkerInfo?.name || talkerName || talkerId,
            face: talkerInfo?.face ? await getCachedBase64(talkerInfo.face) : ""
        },
        self: {
            name: selfInfo?.name || "我",
            face: selfInfo?.face ? await getCachedBase64(selfInfo.face) : ""
        }
    }
}

export async function exportToHTML(
    talkerId: string,
    messages: BiliMsg[],
    config: ExportConfig,
    talkerName: string,
    emoteMap: Record<string, string>,
    onProgress?: (status: string) => void
): Promise<void> {
    try {
        onProgress?.("正在获取用户信息...")
        const users = await getChatUsers(talkerId, messages, talkerName)

        onProgress?.("正在加载表情包...")
        const b64EmoteMap: Record<string, string> = {}
        const emoteKeys = Object.keys(emoteMap)
        for (let i = 0; i < emoteKeys.length; i++) {
            const key = emoteKeys[i]
            b64EmoteMap[key] = await getCachedBase64(emoteMap[key])
            if (i % 10 === 0) {
                onProgress?.(`正在加载表情包 (${Math.round((i / emoteKeys.length) * 100)}%)...`)
            }
        }

        onProgress?.("正在解析并加载聊天图片...")
        const parsedMsgs: ParsedMsg[] = []
        // 反转为时间正序导出
        const sortedMessages = [...messages].reverse()

        for (let i = 0; i < sortedMessages.length; i++) {
            const msg = sortedMessages[i]
            const parsed = parseMessageContent(msg.content, msg.msg_type)
            const isMe = msg.sender_uid.toString() !== talkerId

            if (parsed.image) {
                parsed.image = await getCachedBase64(parsed.image)
            }

            parsedMsgs.push({
                msg,
                parsed,
                isMe,
                timeStr: formatDateTime(msg.timestamp),
                dateLabel: formatDateLabel(msg.timestamp)
            })

            if (i % 20 === 0) {
                onProgress?.(`正在解析消息 (${Math.round((i / sortedMessages.length) * 100)}%)...`)
            }
        }

        onProgress?.("正在生成 HTML 文件...")
        const title = config.titleFormat === TitleFormat.USERNAME 
            ? `与 ${users.talker.name} 的对话记录` 
            : config.titleFormat === TitleFormat.CUSTOM 
            ? config.customTitle 
            : `Bilibili 私信存档 / UID: ${talkerId}`

        const htmlContent = generateHTMLString(title, parsedMsgs, users, b64EmoteMap, config)

        // 触发下载
        const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `BiliChat_${(users.talker.name || talkerId).replace(/[\\/:*?"<>|]/g, "_")}_${new Date().toISOString().split("T")[0]}.html`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)

        onProgress?.("导出成功！")
    } catch (e: any) {
        throw new Error(`HTML 导出失败: ${e.message}`)
    }
}

function generateHTMLString(
    title: string,
    parsedMsgs: ParsedMsg[],
    users: { talker: { name: string; face: string }; self: { name: string; face: string } },
    emoteMap: Record<string, string>,
    config: ExportConfig
): string {
    // 渲染消息项
    let lastDate = ""
    const messagesHtml = parsedMsgs.map(pm => {
        let dateDivider = ""
        if (pm.dateLabel !== lastDate) {
            dateDivider = `<div class="date-divider"><span>${pm.dateLabel}</span></div>`
            lastDate = pm.dateLabel
        }

        const avatar = pm.isMe ? users.self.face : users.talker.face
        const name = pm.isMe ? users.self.name : users.talker.name
        const avatarHtml = avatar 
            ? `<img class="avatar" src="${escAttr(avatar)}" alt="${esc(name)}" />`
            : `<div class="avatar-placeholder">${esc(name.substring(0, 1))}</div>`

        let bubbleContent = ""
        const showTime = config.showMessageTime ? `<div class="msg-time">${pm.timeStr}</div>` : ""

        const p = pm.parsed
        const isRevoked = pm.msg.msg_status === 1 || pm.msg.msg_status === 2 || pm.msg.msg_type === 5

        if (isRevoked) {
            bubbleContent = config.showRevokedContent 
                ? `<div class="bubble bubble-revoked">${replaceEmotes(p.text, emoteMap)} <span class="revoked-tag">(已撤回)</span></div>`
                : `<div class="system-tip">[消息已撤回]</div>`
        } else if (p.type_info === "system") {
            bubbleContent = `<div class="system-tip">${esc(p.text)}</div>`
        } else if (p.type_info === "image" && p.image) {
            bubbleContent = `<div class="bubble bubble-img"><img src="${escAttr(p.image)}" alt="图片" onclick="window.open(this.src)" /></div>`
        } else if (p.type_info === "video" || p.type_info === "article" || p.type_info === "share") {
            const coverHtml = p.image ? `<img class="card-cover" src="${escAttr(p.image)}" alt="" />` : ""
            bubbleContent = `
                <div class="bubble bubble-card" onclick="if('${p.url}') window.open('${p.url}')">
                    ${coverHtml}
                    <div class="card-body">
                        <div class="card-title">${esc(p.text)}</div>
                        ${p.url ? `<div class="card-link">${esc(p.url)}</div>` : ""}
                    </div>
                </div>`
        } else {
            // 普通文本
            bubbleContent = `<div class="bubble">${replaceEmotes(p.text, emoteMap)}</div>`
        }

        // 系统消息居中，不需要头像和左右气泡样式
        if (p.type_info === "system" || (isRevoked && !config.showRevokedContent)) {
            return `
                <div class="msg-item msg-system" data-text="${escAttr(p.text)}">
                    ${dateDivider}
                    ${showTime}
                    ${bubbleContent}
                </div>`
        }

        return `
            ${dateDivider}
            <div class="msg-item ${pm.isMe ? "msg-sent" : "msg-received"}" data-text="${escAttr(p.text)}">
                ${avatarHtml}
                <div class="msg-content-area">
                    <div class="sender-name">${esc(name)}</div>
                    <div class="msg-bubble-row">
                        ${bubbleContent}
                        ${showTime}
                    </div>
                </div>
            </div>`
    }).join("")

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${esc(title)}</title>
    <style>
        :root {
            --bili-pink: #fb7299;
            --bili-blue: #00a1d6;
            --bg-color: #f4f5f7;
            --chat-bg: #ffffff;
            --text-color: #18191c;
            --text-muted: #9499a0;
            --bubble-received: #f1f2f3;
            --bubble-sent: #fb7299;
            --bubble-sent-text: #ffffff;
            --border-color: #e3e5e7;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
            background-color: var(--bg-color);
            color: var(--text-color);
            line-height: 1.6;
            display: flex;
            justify-content: center;
            height: 100vh;
            overflow: hidden;
        }

        .chat-container {
            width: 100%;
            max-width: 800px;
            background-color: var(--chat-bg);
            display: flex;
            flex-direction: column;
            height: 100vh;
            box-shadow: 0 0 20px rgba(0,0,0,0.05);
        }

        /* 顶部导航栏 */
        .chat-header {
            padding: 16px 24px;
            border-bottom: 1px solid var(--border-color);
            display: flex;
            align-items: center;
            justify-content: space-between;
            background-color: #fff;
            z-index: 10;
        }

        .header-info h1 {
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 2px;
        }

        .header-info p {
            font-size: 12px;
            color: var(--text-muted);
        }

        /* 搜索框 */
        .search-box {
            position: relative;
            display: flex;
            align-items: center;
        }

        .search-box input {
            padding: 6px 12px 6px 30px;
            border: 1px solid var(--border-color);
            border-radius: 16px;
            font-size: 13px;
            outline: none;
            width: 200px;
            transition: all 0.3s;
        }

        .search-box input:focus {
            border-color: var(--bili-pink);
            width: 260px;
            box-shadow: 0 0 0 3px rgba(251, 114, 153, 0.1);
        }

        .search-icon {
            position: absolute;
            left: 10px;
            color: var(--text-muted);
            pointer-events: none;
            display: flex;
            align-items: center;
        }

        /* 聊天消息区域 */
        .chat-messages {
            flex: 1;
            overflow-y: auto;
            padding: 24px;
            background-color: #fff;
        }

        /* 日期分隔线 */
        .date-divider {
            display: flex;
            justify-content: center;
            margin: 24px 0 16px;
        }

        .date-divider span {
            font-size: 12px;
            color: var(--text-muted);
            background-color: #f4f5f7;
            padding: 4px 12px;
            border-radius: 12px;
        }

        /* 消息单项 */
        .msg-item {
            display: flex;
            margin-bottom: 20px;
            animation: fadeIn 0.3s ease;
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(5px); }
            to { opacity: 1; transform: translateY(0); }
        }

        /* 头像 */
        .avatar {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            object-fit: cover;
            flex-shrink: 0;
            border: 1px solid var(--border-color);
        }

        .avatar-placeholder {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background-color: var(--bili-pink);
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 16px;
            flex-shrink: 0;
        }

        .msg-content-area {
            margin: 0 12px;
            max-width: 70%;
            display: flex;
            flex-direction: column;
        }

        .sender-name {
            font-size: 12px;
            color: var(--text-muted);
            margin-bottom: 4px;
        }

        .msg-bubble-row {
            display: flex;
            align-items: flex-end;
            gap: 8px;
        }

        /* 气泡样式 */
        .bubble {
            padding: 10px 14px;
            border-radius: 12px;
            font-size: 14px;
            word-break: break-all;
            white-space: pre-wrap;
            box-shadow: 0 1px 2px rgba(0,0,0,0.02);
        }

        /* 接收到的消息 */
        .msg-received .sender-name {
            align-self: flex-start;
        }
        .msg-received .bubble {
            background-color: var(--bubble-received);
            color: var(--text-color);
            border-top-left-radius: 4px;
        }

        /* 发送的消息 */
        .msg-sent {
            flex-direction: row-reverse;
        }
        .msg-sent .msg-content-area {
            align-items: flex-end;
        }
        .msg-sent .bubble {
            background-color: var(--bubble-sent);
            color: var(--bubble-sent-text);
            border-top-right-radius: 4px;
        }
        .msg-sent .msg-bubble-row {
            flex-direction: row-reverse;
        }

        /* 撤回消息 */
        .bubble-revoked {
            background-color: #e8e8e8 !important;
            color: #999 !important;
        }
        .revoked-tag {
            font-size: 11px;
            color: #aaa;
            margin-left: 4px;
        }

        /* 图片消息 */
        .bubble-img {
            padding: 0;
            background: transparent !important;
            box-shadow: none;
            overflow: hidden;
            border-radius: 8px;
        }

        .bubble-img img {
            max-width: 250px;
            max-height: 350px;
            border-radius: 8px;
            cursor: zoom-in;
            display: block;
            border: 1px solid var(--border-color);
            transition: opacity 0.2s;
        }

        .bubble-img img:hover {
            opacity: 0.9;
        }

        /* 卡片消息 (视频、专栏等) */
        .bubble-card {
            background-color: #fafafa !important;
            color: var(--text-color) !important;
            border: 1px solid var(--border-color);
            display: flex;
            gap: 12px;
            cursor: pointer;
            padding: 12px;
            max-width: 320px;
            transition: all 0.2s;
        }

        .bubble-card:hover {
            background-color: #f1f2f3 !important;
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.05);
        }

        .card-cover {
            width: 100px;
            height: 62px;
            border-radius: 4px;
            object-fit: cover;
            background-color: #eee;
            flex-shrink: 0;
        }

        .card-body {
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            min-width: 0;
        }

        .card-title {
            font-size: 13px;
            font-weight: 500;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
            line-height: 1.4;
        }

        .card-link {
            font-size: 11px;
            color: var(--bili-blue);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            margin-top: 4px;
        }

        /* 消息时间 */
        .msg-time {
            font-size: 11px;
            color: var(--text-muted);
            white-space: nowrap;
            margin-bottom: 2px;
        }

        /* 系统消息与撤回提示 */
        .msg-system {
            justify-content: center;
            flex-direction: column;
            align-items: center;
        }

        .system-tip {
            font-size: 12px;
            color: var(--text-muted);
            background-color: #f4f5f7;
            padding: 4px 16px;
            border-radius: 14px;
            margin: 8px 0;
            text-align: center;
            max-width: 80%;
        }

        /* 表情包 */
        .emote-img {
            width: 22px;
            height: 22px;
            vertical-align: text-bottom;
            margin: 0 2px;
        }

        /* 隐藏的消息 */
        .msg-item.hidden {
            display: none !important;
        }
    </style>
</head>
<body>
    <div class="chat-container">
        <div class="chat-header">
            <div class="header-info">
                <h1>${esc(title)}</h1>
                <p>共 ${parsedMsgs.length} 条对话记录${config.showExportTime ? ` · 导出时间: ${new Date().toLocaleString()}` : ""}</p>
            </div>
            <div class="search-box">
                <svg class="search-icon" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                <input type="text" id="searchInput" placeholder="搜索聊天记录..." oninput="filterMessages()" />
            </div>
        </div>
        <div class="chat-messages" id="chatMessages">
            ${messagesHtml}
        </div>
    </div>

    <script>
        function filterMessages() {
            const query = document.getElementById('searchInput').value.toLowerCase().trim();
            const items = document.querySelectorAll('.msg-item');
            
            items.forEach(item => {
                // 如果是日期分割线，我们先默认不隐藏，后面根据是否有可见消息再决定
                if (item.classList.contains('date-divider')) return;

                const text = item.getAttribute('data-text') || '';
                if (query === '' || text.toLowerCase().includes(query)) {
                    item.classList.remove('hidden');
                } else {
                    item.classList.add('hidden');
                }
            });

            // 隐藏没有消息的日期分割线
            const children = document.getElementById('chatMessages').children;
            let currentDivider = null;
            let hasVisibleMessage = false;

            for (let i = 0; i < children.length; i++) {
                const el = children[i];
                if (el.classList.contains('date-divider')) {
                    if (currentDivider && !hasVisibleMessage) {
                        currentDivider.style.display = 'none';
                    }
                    currentDivider = el;
                    hasVisibleMessage = false;
                    el.style.display = '';
                } else if (!el.classList.contains('hidden') && !el.classList.contains('msg-system') && el.style.display !== 'none') {
                    hasVisibleMessage = true;
                }
            }
            if (currentDivider && !hasVisibleMessage) {
                currentDivider.style.display = 'none';
            }
        }
    </script>
</body>
</html>`
}
