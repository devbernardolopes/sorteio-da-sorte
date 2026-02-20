import { payload } from "pix-payload";

export default function handler(req, res) {
  // Setting headers for CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

  // Handle the preflight request for CORS
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  try {
    const pix = payload({
      key: process.env.PIX_KEY,
      name: process.env.PIX_NAME,
      city: process.env.PIX_CITY,
      amount: 10.0,
      transactionId: "SORT" + Math.floor(Math.random() * 9999),
    });

    return res.status(200).json({ copyAndPaste: pix });
  } catch (error) {
    return res.status(500).json({ error: "Failed to generate PIX" });
  }
}
