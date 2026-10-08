mod crypto;
mod storage;
mod wallet;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(wallet::WalletState::default())
        .invoke_handler(tauri::generate_handler![
            wallet::wallet_exists,
            wallet::wallet_create,
            wallet::wallet_unlock,
            wallet::wallet_lock,
            wallet::wallet_sign,
            wallet::vault_save,
            wallet::vault_load,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
