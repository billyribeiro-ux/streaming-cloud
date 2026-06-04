//! Small cross-cutting helpers.

use rand::distr::Alphanumeric;
use rand::Rng;

/// Builds a URL-safe, reasonably-unique slug from a display name.
pub fn slugify(name: &str) -> String {
    let base: String = name
        .to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '-' })
        .collect();
    let base = base.trim_matches('-');
    let suffix: String = rand::rng()
        .sample_iter(Alphanumeric)
        .take(6)
        .map(|b| char::from(b).to_ascii_lowercase())
        .collect();

    if base.is_empty() {
        format!("item-{suffix}")
    } else {
        format!("{base}-{suffix}")
    }
}
