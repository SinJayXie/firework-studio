#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(
      tauri_plugin_snap_layout::init()
        .button_id("snap-btn")
        .build(),
    )
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .invoke_handler(tauri::generate_handler![scan_shell_dir])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

#[derive(serde::Serialize)]
struct ShellFile {
  name: String,
  content: String,
}

/// 返回 shell 目录的绝对路径：
/// - 开发环境：项目根目录下的 shell（tauri dev 的 cwd 通常是 src-tauri，向上回退一层）
/// - 生产环境：可执行文件同级的 shell 目录
fn shell_dir() -> std::path::PathBuf {
  if cfg!(debug_assertions) {
    let cwd = std::env::current_dir().unwrap_or_else(|_| std::path::PathBuf::from("."));
    if cwd.file_name().and_then(|s| s.to_str()) == Some("src-tauri") {
      cwd.parent().map(|p| p.to_path_buf()).unwrap_or(cwd).join("shell")
    } else {
      cwd.join("shell")
    }
  } else {
    std::env::current_exe()
      .ok()
      .and_then(|p| p.parent().map(|d| d.to_path_buf()))
      .unwrap_or_else(|| std::path::PathBuf::from("."))
      .join("shell")
  }
}

#[tauri::command]
fn scan_shell_dir() -> Result<Vec<ShellFile>, String> {
  let dir = shell_dir();
  if !dir.is_dir() {
    return Ok(Vec::new());
  }

  let mut files = Vec::new();
  for entry in std::fs::read_dir(&dir).map_err(|e| e.to_string())? {
    let entry = entry.map_err(|e| e.to_string())?;
    let path = entry.path();
    if path.extension().and_then(|e| e.to_str()) == Some("shell") {
      let name = path.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
      let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
      files.push(ShellFile { name, content });
    }
  }
  files.sort_by(|a, b| a.name.cmp(&b.name));
  Ok(files)
}
