//! Minimal S3 (Cloudflare R2) SigV4 presigner.
//!
//! Generates presigned `PUT`/`GET` URLs so the browser uploads/downloads
//! directly against R2 — the API never proxies file bytes. Implemented against
//! the AWS Signature Version 4 spec and validated with AWS's documented
//! known-answer test (see `tests`), avoiding the heavyweight `aws-sdk-s3` tree.

use chrono::{DateTime, Utc};
use hmac::{Hmac, Mac};
use sha2::{Digest, Sha256};

type HmacSha256 = Hmac<Sha256>;

pub struct PresignParams<'a> {
    pub method: &'a str,
    pub host: &'a str,
    pub region: &'a str,
    pub access_key: &'a str,
    pub secret_key: &'a str,
    pub key: &'a str,
    pub expires_secs: u32,
}

/// Builds a presigned `https://{host}/{key}?…` URL valid for `expires_secs`.
pub fn presign(p: &PresignParams, now: DateTime<Utc>) -> String {
    let amz_date = now.format("%Y%m%dT%H%M%SZ").to_string();
    let datestamp = now.format("%Y%m%d").to_string();
    let scope = format!("{datestamp}/{}/s3/aws4_request", p.region);

    let canonical_uri = format!("/{}", uri_encode(p.key, false));

    let mut query = [
        (
            "X-Amz-Algorithm".to_string(),
            "AWS4-HMAC-SHA256".to_string(),
        ),
        (
            "X-Amz-Credential".to_string(),
            format!("{}/{scope}", p.access_key),
        ),
        ("X-Amz-Date".to_string(), amz_date.clone()),
        ("X-Amz-Expires".to_string(), p.expires_secs.to_string()),
        ("X-Amz-SignedHeaders".to_string(), "host".to_string()),
    ];
    query.sort_by(|a, b| a.0.cmp(&b.0));
    let canonical_query = query
        .iter()
        .map(|(k, v)| format!("{}={}", uri_encode(k, true), uri_encode(v, true)))
        .collect::<Vec<_>>()
        .join("&");

    let canonical_request = format!(
        "{}\n{}\n{}\nhost:{}\n\nhost\nUNSIGNED-PAYLOAD",
        p.method, canonical_uri, canonical_query, p.host
    );

    let string_to_sign = format!(
        "AWS4-HMAC-SHA256\n{amz_date}\n{scope}\n{}",
        sha256_hex(canonical_request.as_bytes())
    );

    let signing_key = signing_key(p.secret_key, &datestamp, p.region);
    let signature = hex_lower(&hmac(&signing_key, string_to_sign.as_bytes()));

    format!(
        "https://{}{}?{}&X-Amz-Signature={}",
        p.host, canonical_uri, canonical_query, signature
    )
}

fn signing_key(secret: &str, datestamp: &str, region: &str) -> Vec<u8> {
    let k_date = hmac(format!("AWS4{secret}").as_bytes(), datestamp.as_bytes());
    let k_region = hmac(&k_date, region.as_bytes());
    let k_service = hmac(&k_region, b"s3");
    hmac(&k_service, b"aws4_request")
}

fn hmac(key: &[u8], msg: &[u8]) -> Vec<u8> {
    let mut mac = HmacSha256::new_from_slice(key).expect("HMAC accepts any key length");
    mac.update(msg);
    mac.finalize().into_bytes().to_vec()
}

fn sha256_hex(bytes: &[u8]) -> String {
    hex_lower(&Sha256::digest(bytes))
}

fn hex_lower(bytes: &[u8]) -> String {
    let mut out = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        out.push_str(&format!("{byte:02x}"));
    }
    out
}

/// RFC 3986 percent-encoding as required by SigV4. `/` is preserved in paths
/// (`encode_slash = false`) and encoded in query values (`true`).
fn uri_encode(input: &str, encode_slash: bool) -> String {
    let mut out = String::with_capacity(input.len());
    for byte in input.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(byte as char);
            }
            b'/' if !encode_slash => out.push('/'),
            _ => out.push_str(&format!("%{byte:02X}")),
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    #[test]
    fn aws_documented_presign_known_answer() {
        // AWS SigV4 "Create a presigned URL" example.
        let now = Utc.with_ymd_and_hms(2013, 5, 24, 0, 0, 0).unwrap();
        let url = presign(
            &PresignParams {
                method: "GET",
                host: "examplebucket.s3.amazonaws.com",
                region: "us-east-1",
                access_key: "AKIAIOSFODNN7EXAMPLE",
                secret_key: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
                key: "test.txt",
                expires_secs: 86400,
            },
            now,
        );

        assert!(
            url.contains(
                "X-Amz-Signature=aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404"
            ),
            "unexpected signature in {url}"
        );
    }
}
