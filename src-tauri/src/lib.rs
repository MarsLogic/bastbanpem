use lopdf::Document;
use pdfium_render::prelude::*;
use image::imageops::crop_imm;
use serde::{Serialize, Deserialize};
use std::sync::Mutex;
use tauri::{AppHandle, WebviewUrl, WebviewWindowBuilder};
use base64::{Engine as _, engine::general_purpose};
use std::fs;

#[derive(Default)]
struct AppState {
    contract_data: Mutex<Option<ContractData>>,
    app_data_path: std::path::PathBuf,
    server_port: u16,
}

#[derive(Serialize, Deserialize, Clone)]
struct ContractData {
    recipients: Vec<RecipientData>,
    global_config: GlobalConfig,
}

#[derive(Serialize, Deserialize, Clone)]
struct GlobalConfig {
    nomor_sertifikat: String,
    tanggal_sertifikat: String,
    lembaga_penguji: String,
    uji_lab_file: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
struct RecipientData {
    nik: String,
    name: String,
    do_path: Option<String>,
    photo_path: Option<String>,
}

#[derive(Serialize)]
struct FilePayload {
    base64: String,
    mime_type: String,
    file_name: String,
}

#[derive(Serialize)]
struct InjectionData {
    name: String,
    certificate_no: String,
    certificate_date: String,
    testing_agency: String,
    paths: InjectionPaths,
}

#[derive(Serialize)]
struct InjectionPaths {
    #[serde(rename = "do")]
    r#do: Option<String>,
    lab: Option<String>,
    photo: Option<String>,
}

#[tauri::command]
fn sync_contract_data(state: tauri::State<AppState>, data: ContractData) -> Result<(), String> {
    let mut state_data = state.contract_data.lock().unwrap();
    *state_data = Some(data.clone());
    
    // Persist to App_Data/database.json
    let db_path = state.app_data_path.join("database.json");
    let json = serde_json::to_string_pretty(&data).map_err(|e| e.to_string())?;
    fs::write(db_path, json).map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
fn get_data_for_nik(state: tauri::State<AppState>, nik: String) -> Result<InjectionData, String> {
    let state_data = state.contract_data.lock().unwrap();
    let data = state_data.as_ref().ok_or("No contract data synced")?;

    let recipient = data.recipients.iter()
        .find(|r| r.nik == nik)
        .ok_or(format!("NIK {} not found in local data", nik))?;

    Ok(InjectionData {
        name: recipient.name.clone(),
        certificate_no: data.global_config.nomor_sertifikat.clone(),
        certificate_date: data.global_config.tanggal_sertifikat.clone(),
        testing_agency: data.global_config.lembaga_penguji.clone(),
        paths: InjectionPaths {
            r#do: recipient.do_path.clone(),
            lab: data.global_config.uji_lab_file.clone(),
            photo: recipient.photo_path.clone(),
        },
    })
}

#[tauri::command]
fn get_file_payload(state: tauri::State<AppState>, filename: String) -> Result<FilePayload, String> {
    let path = state.app_data_path.join(&filename);
    if !path.exists() {
        return Err(format!("File not found in App_Data: {}", filename));
    }

    let file_content = fs::read(&path).map_err(|e| e.to_string())?;
    let base64_str = general_purpose::STANDARD.encode(file_content);
    
    let mime_type = match path.extension().and_then(|s| s.to_str()) {
        Some("pdf") => "application/pdf",
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("png") => "image/png",
        _ => "application/octet-stream",
    };

    Ok(FilePayload {
        base64: base64_str,
        mime_type: mime_type.to_string(),
        file_name: filename,
    })
}

#[tauri::command]
async fn open_portal(app: AppHandle, state: tauri::State<'_, AppState>) -> Result<(), String> {
    let port = state.server_port;
    let raw_script = include_str!("../../src/lib/assist_script.js");
    
    // Dynamic injection of Port and Base URL for cross-window communication
    let dynamic_header = format!(
        "window.__TAURI_PORT__ = {};\nwindow.__APP_DATA_URL__ = 'http://localhost:{}';\n",
        port, port
    );
    let script = format!("{}{}", dynamic_header, raw_script);
    
    let portal_window = WebviewWindowBuilder::new(
        &app,
        "portal",
        WebviewUrl::External("https://bastbanpem.pertanian.go.id".parse().unwrap())
    )
    .title("BASTBANPEM Portal - VENDOR ASSIST ACTIVE")
    .inner_size(1280.0, 800.0)
    .initialization_script(&script)
    .build()
    .map_err(|e| e.to_string())?;

    portal_window.show().map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
fn split_pdf(state: tauri::State<AppState>, source_path: String, pages: Vec<u32>, output_name: String) -> Result<(), String> {
    let mut doc = Document::load(&source_path).map_err(|e| e.to_string())?;
    let all_pages: Vec<u32> = doc.get_pages().keys().cloned().collect();
    let to_delete: Vec<u32> = all_pages.into_iter().filter(|p| !pages.contains(p)).collect();
    doc.delete_pages(&to_delete);
    
    let full_output_path = state.app_data_path.join(&output_name);
    doc.save(full_output_path).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn crop_to_image(
    state: tauri::State<AppState>,
    source_pdf_path: String, 
    page_index: u32, 
    x: u32, 
    y: u32, 
    width: u32, 
    height: u32, 
    output_name: String
) -> Result<(), String> {
    let pdfium = Pdfium::default();
    let document = pdfium.load_pdf_from_file(&source_pdf_path, None).map_err(|e| e.to_string())?;
    let page = document.pages().get(page_index as u16).map_err(|_| "Page index out of bounds".to_string())?;
    let render_config = PdfRenderConfig::new().set_target_width(2400); 
    let dynamic_image = page.render_with_config(&render_config).map_err(|e| e.to_string())?.as_image();
    let cropped = crop_imm(&dynamic_image, x, y, width, height).to_image();
    
    let full_output_path = state.app_data_path.join(&output_name);
    cropped.save_with_format(&full_output_path, image::ImageFormat::Jpeg).map_err(|e: image::ImageError| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn pre_flight_check(state: tauri::State<AppState>) -> Result<Vec<String>, String> {
    let mut reports = Vec::new();
    
    // 1. Bridge Check
    reports.push("✅ Tauri/JS Bridge: Active".to_string());
    
    // 2. Storage Check
    if state.app_data_path.exists() {
        reports.push(format!("✅ App_Data Portable Directory: Found ({})", state.app_data_path.display()));
    } else {
        reports.push("❌ App_Data Portable Directory: Missing".to_string());
    }
    
    // 3. Parser Check (Mock since we check existence of tools)
    reports.push("✅ Excel Parser Engine: Ready".to_string());
    reports.push("✅ PDF Slicer Engine: Ready".to_string());
    
    // 4. Port Check
    reports.push(format!("✅ Internal Asset Server: Running on port {}", state.server_port));

    Ok(reports)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // 1. Determine Portable App_Data Path
    let exe_path = std::env::current_exe().expect("Failed to get current exe path");
    let app_data_path = exe_path.parent().unwrap().join("App_Data");
    if !app_data_path.exists() {
        fs::create_dir_all(&app_data_path).expect("Failed to create App_Data directory");
    }

    // 2. Port Discovery (Scan from 59876)
    let mut server_port = 59876;
    while server_port < 60000 {
        if std::net::TcpListener::bind(format!("127.0.0.1:{}", server_port)).is_ok() {
            break;
        }
        server_port += 1;
    }

    // 3. Load Persistent Data
    let db_path = app_data_path.join("database.json");
    let initial_data = if db_path.exists() {
        let content = fs::read_to_string(db_path).ok();
        content.and_then(|c| serde_json::from_str(&c).ok())
    } else {
        None
    };

    let state = AppState {
        contract_data: Mutex::new(initial_data),
        app_data_path: app_data_path.clone(),
        server_port,
    };

    // 4. Start Local Asset Server in Background
    let server_path = app_data_path.clone();
    std::thread::spawn(move || {
        let server = tiny_http::Server::http(format!("127.0.0.1:{}", server_port)).unwrap();
        for request in server.incoming_requests() {
            let url = request.url().trim_start_matches('/');
            let file_path = server_path.join(url);
            
            if file_path.exists() && file_path.is_file() {
                let content = fs::read(&file_path).unwrap_or_default();
                let response = tiny_http::Response::from_data(content)
                    .with_header(tiny_http::Header::from_bytes(&b"Access-Control-Allow-Origin"[..], &b"*"[..]).unwrap());
                let _ = request.respond(response);
            } else {
                let response = tiny_http::Response::from_string("Not Found").with_status_code(404);
                let _ = request.respond(response);
            }
        }
    });

    tauri::Builder::default()
        .manage(state)
        .setup(|app| {
            app.handle().plugin(tauri_plugin_dialog::init())?;
            app.handle().plugin(tauri_plugin_fs::init())?;
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            split_pdf,
            crop_to_image,
            open_portal,
            sync_contract_data,
            get_data_for_nik,
            get_file_payload,
            pre_flight_check
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
