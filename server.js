require("dotenv").config();
const express = require("express");
const { payload } = require("pix-payload");
const cors = require("cors"); // Install this: npm install cors

const app = express();
app.use(cors()); // Allows your HTML file to talk to this server

app.get("/generate-pix", (req, res) => {
  try {
    const pix = payload({
      key: process.env.PIX_KEY,
      name: process.env.PIX_NAME,
      city: process.env.PIX_CITY,
      amount: 10.0,
      transactionId: "SORT" + Math.floor(Math.random() * 9999),
    });

    res.json({ copyAndPaste: pix });
  } catch (error) {
    res.status(500).json({ error: "Failed to generate PIX" });
  }
});

// Add this above your app.listen
app.get("/", (req, res) => {
  res.send("PIX Server is running! Use /generate-pix to get a code.");
});

app.listen(3000, () => console.log("Server running on http://localhost:3000"));
