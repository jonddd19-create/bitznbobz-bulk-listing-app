const JSZip = require("jszip");
const axios = require("axios");

async function buildImagesZipBase64(images) {
  const zip = new JSZip();

  for (const img of images) {
    try {
      const res = await axios.get(img.url, {
        responseType: "arraybuffer",
        timeout: 20000
      });
      zip.file(img.filename, res.data);
    } catch {
      // skip failed images silently
    }
  }

  const zipped = await zip.generateAsync({ type: "nodebuffer" });
  return zipped.toString("base64");
}

module.exports = { buildImagesZipBase64 };
