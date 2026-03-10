const express = require("express");
const cors = require("cors");
const axios = require("axios");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: [
    "http://localhost:3000",
    "http://localhost:5173",
    "https://dhruvin-sarkar-dev.vercel.app",
    "https://dhruvin-sarkar.dev",
    "https://www.dhruvin-sarkar.dev"
  ]
}));

app.use(express.json());

// ─── NEWS ────────────────────────────────────────────────────────────────────
// GET /news/getNews
// Returns top headlines from NewsAPI + current weather from OpenWeatherMap
// Frontend can pass ?lat=&lon= for local weather, falls back to Toronto
app.get("/news/getNews", async (req, res) => {
  try {
    const { lat = "43.65", lon = "-79.38" } = req.query;

    // Fetch news
    const newsRes = await axios.get("https://newsapi.org/v2/top-headlines", {
      params: {
        country: "us",
        pageSize: 10,
        apiKey: process.env.NEWS_API_KEY,
      },
    });

    // Fetch weather
    const weatherRes = await axios.get(
      "https://api.openweathermap.org/data/2.5/weather",
      {
        params: {
          lat,
          lon,
          appid: process.env.WEATHER_API_KEY,
          units: "metric",
        },
      }
    );

    const articles = newsRes.data.articles.map((a) => ({
      title: a.title,
      description: a.description,
      url: a.url,
      urlToImage: a.urlToImage,
      publishedAt: a.publishedAt,
      source: a.source?.name,
    }));

    const w = weatherRes.data;
    const weather = {
      temp_c: Math.round(w.main.temp),
      temp_f: Math.round((w.main.temp * 9) / 5 + 32),
      description: w.weather[0]?.description,
      icon: w.weather[0]?.icon,
      city: w.name,
      is_night: w.weather[0]?.icon?.includes("n"),
    };

    res.json({ articles, weather });
  } catch (err) {
    console.error("News/weather fetch error:", err.message);
    res.status(500).json({ error: "Failed to fetch news or weather" });
  }
});

// Health check
app.get("/", (req, res) => res.send("News backend running ✅"));

app.listen(PORT, () => console.log(`News backend listening on port ${PORT}`));
