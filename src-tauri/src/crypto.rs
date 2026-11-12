use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use hkdf::Hkdf;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256, Sha512};
use x25519_dalek::{PublicKey, StaticSecret};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RatchetEnvelope {
    pub ratchet_step: i64,
    pub cipher_hex: String,
    pub safety_number: String,
}

pub struct SignalEngine {
    root_key: [u8; 32],
    chain_key: [u8; 32],
    dh_secret: StaticSecret,
}

impl SignalEngine {
    pub fn new() -> Self {
        let dh_secret = StaticSecret::random_from_rng(rand::thread_rng());
        Self {
            root_key: [0x5A; 32],
            chain_key: [0x3C; 32],
            dh_secret,
        }
    }

    pub fn encrypt_ratchet(&mut self, chat_id: &str, plaintext: &str, step: i64) -> RatchetEnvelope {
        let hk = Hkdf::<Sha256>::new(Some(&self.root_key), &self.chain_key);
        let mut next_chain = [0u8; 32];
        let mut msg_key = [0u8; 32];
        hk.expand(b"WhisperRustChainKey", &mut next_chain).expect("HKDF expand chain");
        hk.expand(b"WhisperRustMsgKey", &mut msg_key).expect("HKDF expand msg");
        self.chain_key = next_chain;

        let cipher = Aes256Gcm::new_from_slice(&msg_key).expect("AES-256-GCM init");
        let mut nonce_bytes = [0u8; 12];
        nonce_bytes[4..12].copy_from_slice(&(step as u64).to_be_bytes());
        let nonce = Nonce::from_slice(&nonce_bytes);

        let encrypted = cipher
            .encrypt(nonce, plaintext.as_bytes())
            .unwrap_or_else(|_| plaintext.as_bytes().to_vec());

        let pub_key = PublicKey::from(&self.dh_secret);
        RatchetEnvelope {
            ratchet_step: step,
            cipher_hex: hex::encode(encrypted),
            safety_number: Self::generate_safety_number(pub_key.as_bytes(), chat_id.as_bytes()),
        }
    }

    pub fn generate_safety_number(local_ik: &[u8], remote_ik: &[u8]) -> String {
        let mut hasher = Sha512::new();
        hasher.update(local_ik);
        hasher.update(remote_ik);
        let digest = hasher.finalize();

        (0..12)
            .map(|idx| {
                let offset = idx * 5;
                let n = u32::from_be_bytes([
                    digest[offset],
                    digest[offset + 1],
                    digest[offset + 2],
                    digest[offset + 3],
                ]) % 100_000;
                format!("{:05}", n)
            })
            .collect::<Vec<_>>()
            .join(" ")
    }

    pub fn hash_pin(pin: &str) -> String {
        let mut hasher = Sha256::new();
        hasher.update(b"whisper_rust_pin_salt_v2:");
        hasher.update(pin.as_bytes());
        hex::encode(hasher.finalize())
    }
}
