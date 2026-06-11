/**
 * Sanitize arbitrary text (typically README-derived summaries) for safe display
 * on iOS Safari / Android Chrome where the system font stack doesn't cover all
 * Unicode glyphs — especially arrows that come through as `â■■` mojibake.
 *
 * Strategy: normalize common typographic characters to ASCII equivalents,
 * then drop any remaining non-printable/non-ASCII so we never render tofu.
 * This is strictly a display helper — keep raw data untouched in state.
 *
 * @param {string} s
 * @returns {string}
 */
export function cleanSummary(s) {
  if (!s) return '';
  return String(s)
    // Arrow variants → plain ASCII arrow-like sequence
    .replace(/[\u2190\u2192\u2794\u279C\u27A1\u21D2\u2B62]/g, '->')
    // En/em dashes → hyphen
    .replace(/[\u2013\u2014]/g, '-')
    // Smart single quotes → apostrophe
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    // Smart double quotes → straight
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    // Ellipsis
    .replace(/\u2026/g, '...')
    // Bullets
    .replace(/[\u2022\u25CF\u25A0\u25E6]/g, '-')
    // Non-breaking space → regular
    .replace(/\u00A0/g, ' ')
    // Final safety: strip anything outside printable ASCII + newlines/tabs
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

export default cleanSummary;
