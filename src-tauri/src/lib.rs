pub mod crypto;
pub mod db;
pub mod whatsapp_bridge;

use std::sync::Mutex;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, State,
};
use crypto::SignalEngine;
use db::{AccountRecord, VaultDb};
use whatsapp_bridge::{CompanionSessionManager, CompanionSessionState};

pub struct AppState {
    pub db: Mutex<VaultDb>,
    pub signal: Mutex<SignalEngine>,
    pub companion: Mutex<CompanionSessionManager>,
}

#[tauri::command]
fn get_accounts(state: State<'_, AppState>) -> Result<Vec<AccountRecord>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.list_accounts().map_err(|e| e.to_string())
}

#[tauri::command]
fn create_account(
    state: State<'_, AppState>,
    id: String,
    name: String,
    phone: String,
    color: String,
) -> Result<Vec<AccountRecord>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.insert_account(&id, &name, &phone, &color)
        .map_err(|e| e.to_string())?;
    db.list_accounts().map_err(|e| e.to_string())
}

#[tauri::command]
fn compute_ratchet_envelope(
    state: State<'_, AppState>,
    chat_id: String,
    plaintext: String,
    step: i64,
) -> Result<crypto::RatchetEnvelope, String> {
    let mut sig = state.signal.lock().map_err(|e| e.to_string())?;
    Ok(sig.encrypt_ratchet(&chat_id, &plaintext, step))
}

#[tauri::command]
fn start_companion_qr_session(
    state: State<'_, AppState>,
    account_id: String,
) -> Result<CompanionSessionState, String> {
    let mut comp = state.companion.lock().map_err(|e| e.to_string())?;
    Ok(comp.start_qr_linking(&account_id))
}

#[tauri::command]
fn request_companion_pairing_code(
    state: State<'_, AppState>,
    account_id: String,
    phone_number: String,
) -> Result<CompanionSessionState, String> {
    let mut comp = state.companion.lock().map_err(|e| e.to_string())?;
    Ok(comp.request_phone_pairing_code(&account_id, &phone_number))
}

fn setup_system_tray(app: &AppHandle) -> tauri::Result<()> {
    let show_item = MenuItem::with_id(app, "show", "Show WhisperRust Pro", true, None::<&str>)?;
    let stealth_item = MenuItem::with_id(
        app,
        "toggle_stealth",
        "Toggle Privacy Stealth Mode",
        true,
        None::<&str>,
    )?;
    let lock_item =
        MenuItem::with_id(app, "lock_app", "Lock Workstation Now", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit WhisperRust", true, None::<&str>)?;

    let menu = Menu::with_items(app, &[&show_item, &stealth_item, &lock_item, &quit_item])?;

    let _tray = TrayIconBuilder::new()
        .menu(&menu)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "toggle_stealth" => {
                let _ = app.emit("whisper://toggle-stealth", ());
            }
            "lock_app" => {
                let _ = app.emit("whisper://lock-app", ());
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        })
        .build(app)?;

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            let app_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&app_dir)?;
            let db_path = app_dir.join("whisper_rust_pro.sqlite");

            let db = VaultDb::open(&db_path).expect("Failed to open SQLCipher database");
            app.manage(AppState {
                db: Mutex::new(db),
                signal: Mutex::new(SignalEngine::new()),
                companion: Mutex::new(CompanionSessionManager::new()),
            });

            let _ = setup_system_tray(app.handle());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_accounts,
            create_account,
            compute_ratchet_envelope,
            start_companion_qr_session,
            request_companion_pairing_code,
        ])
        .run(tauri::generate_context!())
        .expect("error while running WhisperRust Pro Tauri v2 application");
}
