/**
 * 文件读写 composable
 * - Tauri 环境：使用原生文件对话框 + 文件系统 API
 * - 浏览器环境：回退到 <input type="file"> 打开 + Blob 下载保存
 */

import { open, save } from "@tauri-apps/plugin-dialog"
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs"

export interface FileResult {
  name: string
  content: string
  path?: string // 仅 Tauri 环境有文件路径
}

const isTauri = !!(window as any).__TAURI_INTERNALS__

/** 浏览器：触发文件下载 */
function downloadFile(content: string, fileName: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** Tauri：保存到已有路径或弹对话框选路径 */
async function saveFileTauri(content: string, currentPath?: string): Promise<string | null> {
  const filePath = currentPath || await save({
    filters: [{ name: "Shell Script", extensions: ["shell"] }],
    defaultPath: "untitled.shell",
  })
  if (!filePath) return null

  await writeTextFile(filePath, content)
  return filePath
}

/** Tauri：打开文件对话框 */
async function openFileTauri(): Promise<FileResult | null> {
  const selected = await open({
    multiple: false,
    filters: [{ name: "Shell Script", extensions: ["shell"] }],
  })
  if (!selected) return null

  const path = selected as string
  const content = await readTextFile(path)
  const name = path.split(/[\\/]/).pop() || "untitled.shell"
  return { name, content, path }
}

/** 浏览器：<input type="file"> 打开 */
function openFileBrowser(): Promise<FileResult | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = ".shell"
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) { input.remove(); resolve(null); return }
      const reader = new FileReader()
      reader.onload = () => {
        const result: FileResult = {
          name: file.name,
          content: reader.result as string,
        }
        input.remove()
        resolve(result)
      }
      reader.readAsText(file)
    }
    input.click()
  })
}

/** 浏览器：触发下载 */
function saveFileBrowser(content: string, fileName: string): null {
  downloadFile(content, fileName)
  return null
}

export function useFileIO() {
  /** 打开文件，返回文件名、内容和路径（Tauri才有） */
  async function openFile(): Promise<FileResult | null> {
    if (isTauri) return openFileTauri()
    return openFileBrowser()
  }

  /**
   * 保存文件
   * - Tauri：有 currentPath 则直接覆盖保存，否则弹保存对话框
   * - 浏览器：触发下载
   * @returns 保存后的文件路径（Tauri），浏览器返回 null
   */
  async function saveFile(content: string, currentPath?: string): Promise<string | null> {
    if (isTauri) return saveFileTauri(content, currentPath)
    saveFileBrowser(content, currentPath ? currentPath.split(/[\\/]/).pop()! : "untitled.shell")
    return null
  }

  return { openFile, saveFile }
}
