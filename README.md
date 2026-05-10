# Bili Chat Exporter

Bilibili 私信导出 Chrome 扩展，支持将对话记录导出为 PDF 或 JSON 格式。

## 功能

- 自动识别当前私信对话对象
- 导出完整历史消息（分页自动回溯）
- PDF 导出：智能排版、内嵌表情/图片、日期分隔、页码
- JSON 导出：结构化数据，含解析后的内容字段
- 支持 18 种消息类型（文本、图片、视频、专栏、番剧、直播间等）
- 可配置标题格式、时间显示、撤回消息显示等选项

## 技术栈

- [Plasmo](https://www.plasmo.com/) - Chrome MV3 扩展框架
- React 18 + TypeScript
- Tailwind CSS（`plasmo-` 前缀防冲突）
- jsPDF + html2canvas - PDF 生成
- Framer Motion - 动画

## 开发

```bash
npm install
npm run dev      # 启动开发模式
npm run build    # 生产构建
npm run package  # 打包扩展
```

## 项目结构

```
src/
  content.tsx              # Content Script，注入 B 站私信页面
  popup.tsx                # 扩展弹窗（设置面板）
  core/
    api/bilibili.ts        # B 站 API 封装
    parser/message.ts      # 消息解析器
    exporters/pdf.ts       # PDF 导出引擎
    exporters/json.ts      # JSON 导出引擎
    storage/config.ts      # 配置持久化
  types/                   # TypeScript 类型定义
  utils/                   # 工具函数
```

## 权限说明

| 权限 | 用途 |
|------|------|
| `storage` | 存储用户配置 |
| `tabs` | 标签页操作 |
| `api.vc.bilibili.com` | 私信 API |
| `message.bilibili.com` | 私信页面注入 |
| `*.hdslb.com` | B 站图片资源 |

## License

MIT
