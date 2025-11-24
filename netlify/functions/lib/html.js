function escapeHtml(s = "") {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function section(title, html) {
  return `
<div style="background:#0b0b0b;border:1px solid #333;border-radius:10px;padding:12px;margin-bottom:10px;">
  <div style="font-size:16px;font-weight:900;color:#FFD400;margin-bottom:6px;">${title}</div>
  <div style="font-size:14px;line-height:1.5;">${html}</div>
</div>`.trim();
}

function defaultPostage() {
  return section(
    "Postage",
    `<ul>
      <li>Fast UK dispatch.</li>
      <li>Tracked delivery on most items.</li>
    </ul>`
  );
}

function defaultReturns() {
  return section(
    "Returns",
    `<ul>
      <li>30-day returns accepted.</li>
    </ul>`
  );
}

function buildBitznBobzHtml({
  seoTitle,
  condition,
  shortDesc,
  featuresHtml,
  specsHtml,
  whatsInBoxHtml,
  postageHtml,
  returnsHtml
}) {
  return `
<div style="font-family:Aptos,Arial,sans-serif;background:#000;color:#fff;padding:14px;border:3px solid #FFD400;border-radius:12px;">

  <div style="font-size:22px;font-weight:900;color:#FFD400;margin-bottom:8px;">
    BITZ’n’BOBZ
  </div>

  <div style="background:#111;border:2px solid #FFD400;border-radius:10px;padding:12px;margin-bottom:12px;">
    <div style="font-size:20px;font-weight:900;color:#FFD400;margin-bottom:6px;">
      ${escapeHtml(seoTitle || "Item")}
    </div>
    ${condition ? `<div><b>Condition:</b> ${escapeHtml(condition)}</div>` : ""}
    ${shortDesc || ""}
  </div>

  ${featuresHtml ? section("Key Features", featuresHtml) : ""}
  ${specsHtml ? section("Specifications", specsHtml) : ""}
  ${whatsInBoxHtml ? section("What’s in the Box", whatsInBoxHtml) : ""}

  ${postageHtml ? section("Postage", postageHtml) : defaultPostage()}
  ${returnsHtml ? section("Returns", returnsHtml) : defaultReturns()}

  <div style="margin-top:12px;background:#FFD400;color:#000;padding:10px;border-radius:8px;font-weight:800;font-size:13px;">
    BITZ’n’BOBZ — Friendly UK Seller • Fast Dispatch
  </div>

</div>`.trim();
}

module.exports = { buildBitznBobzHtml };
