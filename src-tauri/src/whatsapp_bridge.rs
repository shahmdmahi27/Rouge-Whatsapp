use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
use rand::RngCore;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use x25519_dalek::{PublicKey, StaticSecret};

pub const WHATSAPP_WEB_WS_ENDPOINT: &str = "wss://web.whatsapp.com/ws/chat";
pub const NOISE_PROTOCOL_NAME: &str = "Noise_XX_25519_AESGCM_SHA256";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompanionSessionState {
    pub account_id: String,
    pub status: String, // "disconnected" | "qr_ready" | "pairing_code_ready" | "connected"
    pub qr_payload: Option<String>,
    pub qr_lifetime_secs: u32,
    pub pairing_code: Option<String>,
    pub pairing_lifetime_secs: u32,
    pub connected_jid: Option<String>,
    pub push_name: Option<String>,
    pub platform_os: String,
    pub noise_pub_hex: String,
}

pub struct CompanionSessionManager {
    sessions: HashMap<String, CompanionSessionState>,
}

impl CompanionSessionManager {
    pub fn new() -> Self {
        Self {
            sessions: HashMap::new(),
        }
    }

    pub fn start_qr_linking(&mut self, account_id: &str) -> CompanionSessionState {
        let mut noise_bytes = [0u8; 32];
        rand::thread_rng().fill_bytes(&mut noise_bytes);
        let noise_secret = StaticSecret::from(noise_bytes);
        let noise_pub = PublicKey::from(&noise_secret);

        let mut identity_bytes = [0u8; 32];
        rand::thread_rng().fill_bytes(&mut identity_bytes);
        let identity_secret = StaticSecret::from(identity_bytes);
        let identity_pub = PublicKey::from(&identity_secret);

        let mut adv_secret = [0u8; 32];
        rand::thread_rng().fill_bytes(&mut adv_secret);

        let mut ref_hasher = Sha256::new();
        ref_hasher.update(account_id.as_bytes());
        ref_hasher.update(noise_pub.as_bytes());
        let server_ref = B64.encode(&ref_hasher.finalize()[..16]);

        let qr_string = format!(
            "2@{},{},{},{}",
            server_ref,
            B64.encode(noise_pub.as_bytes()),
            B64.encode(identity_pub.as_bytes()),
            B64.encode(adv_secret)
        );

        let state = CompanionSessionState {
            account_id: account_id.to_string(),
            status: "qr_ready".to_string(),
            qr_payload: Some(qr_string),
            qr_lifetime_secs: 60,
            pairing_code: None,
            pairing_lifetime_secs: 0,
            connected_jid: None,
            push_name: None,
            platform_os: "Whisper Desktop".to_string(),
            noise_pub_hex: hex::encode(noise_pub.as_bytes()),
        };

        self.sessions.insert(account_id.to_string(), state.clone());
        state
    }

    pub fn request_phone_pairing_code(
        &mut self,
        account_id: &str,
        phone_number: &str,
    ) -> CompanionSessionState {
        let mut hasher = Sha256::new();
        hasher.update(account_id.as_bytes());
        hasher.update(phone_number.as_bytes());
        let digest = hasher.finalize();
        let alphabet = b"ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        let chars: String = (0..8)
            .map(|i| alphabet[(digest[i] as usize) % alphabet.len()] as char)
            .collect();
        let formatted_code = format!("{}-{}", &chars[0..4], &chars[4..8]);

        let state = CompanionSessionState {
            account_id: account_id.to_string(),
            status: "pairing_code_ready".to_string(),
            qr_payload: None,
            qr_lifetime_secs: 0,
            pairing_code: Some(formatted_code),
            pairing_lifetime_secs: 180,
            connected_jid: None,
            push_name: None,
            platform_os: "Whisper Desktop".to_string(),
            noise_pub_hex: hex::encode(&digest[..16]),
        };

        self.sessions.insert(account_id.to_string(), state.clone());
        state
    }
}
