const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
app.use(cors());
app.use(express.json());

// Ruta base
app.get("/", (req, res) => {
  res.send("NextGen Founders API running 🚀");
});

// Endpoint Mentor IA
app.post("/mentor", async (req, res) => {
  const { message } = req.body;

  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.API_KEY}`,
      {
        contents: [
          {
            parts: [
              {
                text: `You are the AI mentor of NextGen Founders.
You help teenagers (14-18) build their first business.

Be:
- simple
- practical
- step by step
- motivating but real

User: ${message}`
              }
            ]
          }
        ]
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).send("Error with AI");
  }
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
