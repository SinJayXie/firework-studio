// language.ts — firework.shell 的 Monaco 语言定义（语法高亮、括号配对、主题）
import * as monaco from "monaco-editor"
import EditorWorker from "monaco-editor/editor/editor.worker?worker"

export const FIREWORK_SHELL_LANG = "firework-shell"
export const FIREWORK_SHELL_THEME = "firework-shell-dark"

// Monaco 只需要 editor worker，不依赖任何语言服务 worker。
globalThis.MonacoEnvironment = {
  getWorker: () => new EditorWorker(),
}

let registered = false

/** 幂等注册 firework.shell 语言（语法高亮 + 语言配置 + 主题）。 */
export function ensureFireworkShellLanguage(): void {
  if (registered) return
  registered = true

  monaco.languages.register({ id: FIREWORK_SHELL_LANG })

  monaco.languages.setLanguageConfiguration(FIREWORK_SHELL_LANG, {
    comments: { lineComment: "//", blockComment: ["/*", "*/"] },
    brackets: [
      ["{", "}"],
      ["(", ")"],
      ["[", "]"],
    ],
    autoClosingPairs: [
      { open: "{", close: "}" },
      { open: "(", close: ")" },
      { open: "[", close: "]" },
      { open: '"', close: '"' },
    ],
    surroundingPairs: [
      { open: "{", close: "}" },
      { open: "(", close: ")" },
      { open: "[", close: "]" },
      { open: '"', close: '"' },
    ],
  })

  monaco.languages.setMonarchTokensProvider(FIREWORK_SHELL_LANG, {
    keywords: ["firework", "onDeath", "burst", "flash", "arc", "spiral", "ring", "wave", "heart", "star", "cross", "snowflake", "flower", "square", "triangle", "arrow", "rain", "vortex", "fountain", "galaxy", "text"],
    builtins: ["true", "false", "random", "inherit", "gradient"],
    props: [
      "name", "size", "life", "lifeVariation", "density", "starCount",
      "color", "secondColor", "glitter", "glitterColor",
      "ring", "horsetail", "strobe", "strobeColor",
      "pistil", "pistilColor", "streamers",
      "crossette", "crackle", "floral", "fallingLeaves",
      "gravity", "fade", "launchHeight", "speed", "delay", "duration",
    ],
    tokenizer: {
      root: [
        [/\/\/.*$/, "comment"],
        [/\/\*/, "comment", "@blockComment"],
        [/"([^"\\]|\\.)*"/, "string"],
        [/"/, "string.invalid"],
        [/#[0-9a-fA-F]{6}\b/, "color"],
        [/-?\d+(\.\d+)?([eE][+-]?\d+)?/, "number"],
        [/[\u4e00-\u9fff_a-zA-Z][\u4e00-\u9fff_a-zA-Z0-9_]*/, {
          cases: {
            "@keywords": "keyword",
            "@builtins": "type",
            "@props": "attribute",
            "@default": "identifier",
          },
        }],
        [/[{}()[\]],=]/, "delimiter"],
      ],
      blockComment: [
        [/[^/*]+/, "comment"],
        [/\*\//, "comment", "@pop"],
        [/[/*]/, "comment"],
      ],
    },
  })

  monaco.editor.defineTheme(FIREWORK_SHELL_THEME, {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "6A9955", fontStyle: "italic" },
      { token: "keyword", foreground: "569CD6" },
      { token: "string", foreground: "CE9178" },
      { token: "number", foreground: "B5CEA8" },
      { token: "color", foreground: "CE9178" },
      { token: "type", foreground: "4FC1FF" },
      { token: "attribute", foreground: "9CDCFE" },
      { token: "identifier", foreground: "D4D4D4" },
      { token: "delimiter", foreground: "D4D4D4" },
    ],
    colors: {},
  })
}
