const ExcelJS = require("exceljs");

const HEADERS = [
  "Product URL",
  "Action(SiteID=UK|Country=GB|Currency=GBP|Version=1193|CC=UTF-8)",
  "Custom label (SKU) (create one for me)",
  "Ebay UK Category ID",
  "Title SEO and focused on organic traffic ) 80 letters max",
  "UPC Ignore",
  "Price take the price of the listing and reduce by 20%",
  "Quantity (default to 1(",
  "Item photo URL ignore",
  "Condition ID (default to new(",
  "Description ( BITZ’n’BOBZ  HTML Template Fotmat)",
  "Format Default to FixedPrice"
];

async function buildWorkbookBase64(rows) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("eBay Draft Pack");

  ws.addRow(HEADERS).font = { bold: true };

  rows.forEach(r => {
    ws.addRow([
      r.ProductURL,
      r.Action,
      r.SKU,
      r.CategoryID,
      r.SEOTitle,
      r.UPC,
      r.PriceMinus20,
      r.Quantity,
      r.PhotoURL,
      r.Condition,
      r.DescriptionHTML,
      r.Format
    ]);
  });

  ws.columns.forEach(col => {
    const headerLen = String(col.header || "").length;
    col.width = Math.min(80, Math.max(18, headerLen + 4));
  });

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf).toString("base64");
}

module.exports = { buildWorkbookBase64 };
