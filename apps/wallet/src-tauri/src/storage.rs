//! Files in the app's private data directory. Everything written here is already encrypted.

use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

fn path(app: &AppHandle, name: &str) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join(name))
}

pub fn read(app: &AppHandle, name: &str) -> Result<Option<Vec<u8>>, String> {
    let path = path(app, name)?;
    if !path.exists() {
        return Ok(None);
    }
    fs::read(path).map(Some).map_err(|e| e.to_string())
}

/// Writes to a temp file then renames, so a crash can't leave a half-written key file.
pub fn write(app: &AppHandle, name: &str, data: &[u8]) -> Result<(), String> {
    let path = path(app, name)?;
    let tmp = path.with_extension("tmp");
    fs::write(&tmp, data).map_err(|e| e.to_string())?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&tmp, fs::Permissions::from_mode(0o600)).map_err(|e| e.to_string())?;
    }
    fs::rename(tmp, path).map_err(|e| e.to_string())
}
