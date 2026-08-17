// bundled-shells.ts — 自动收集项目根目录 shell-script/ 下的所有 .shell 脚本。
// 这些文件在构建时由 Vite 打包进产物，运行时无需额外读取文件系统。

const modules = import.meta.glob("/shell-script/*.shell", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>

export interface BundledShell {
  /** 文件名（不含目录），用于稳定排序。 */
  name: string
  /** 脚本内容。 */
  content: string
}

/** 返回 shell-script 目录下全部 .shell 文件（按文件名排序，保证重名时覆盖顺序稳定）。 */
export function listBundledShells(): BundledShell[] {
  return Object.entries(modules)
    .map(([path, content]) => ({
      name: path.split("/").pop() || path,
      content,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}
