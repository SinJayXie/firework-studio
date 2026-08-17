// shell-scanner.ts — 运行时扫描 shell/ 目录下的所有 .shell 脚本。
// Tauri 环境：调用自定义命令 scan_shell_dir 读取文件系统；
// 浏览器环境：回退到 Vite 打包的 /shell/*.shell。

import { invoke } from "@tauri-apps/api/core"

export interface BundledShell {
  /** 文件名（不含目录），用于稳定排序。 */
  name: string
  /** 脚本内容。 */
  content: string
}

const isTauri = !!(window as any).__TAURI_INTERNALS__

// 浏览器回退：构建时打包 shell/ 目录下的脚本
const modules = import.meta.glob("/shell/*.shell", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>

function scanBrowser(): BundledShell[] {
  return Object.entries(modules)
    .map(([path, content]) => ({
      name: path.split("/").pop() || path,
      content,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

async function scanTauri(): Promise<BundledShell[]> {
  try {
    return await invoke<BundledShell[]>("scan_shell_dir")
  } catch {
    return []
  }
}

/** 返回 shell 目录下全部 .shell 文件（按文件名排序，保证重名时覆盖顺序稳定）。 */
export async function scanShellDirectory(): Promise<BundledShell[]> {
  if (isTauri) return scanTauri()
  return scanBrowser()
}
