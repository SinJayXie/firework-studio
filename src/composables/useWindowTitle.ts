import { ref } from "vue"

// 模块级单例状态：供编辑器与窗口标题栏共享当前文件名
const fileName = ref("")

export function useWindowTitle() {
  function setFileName(name: string) {
    fileName.value = name
  }

  return {
    fileName,
    setFileName,
  }
}
