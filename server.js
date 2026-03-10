const express = require("express");
const cors = require("cors");
const axios = require("axios");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;
const LASTFM_API_URL = "http://ws.audioscrobbler.com/2.0/";
const LASTFM_API_KEY = "6ec77ebf567c251f40a5bc2b16b225a9";
const LASTFM_USERNAME = "DhruvinSrkr";

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

const toArray = (value) => {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
};

const getImageUrl = (images = []) => {
  const imageList = toArray(images);
  const preferredSizes = ["mega", "extralarge", "large", "medium", "small"];

  for (const size of preferredSizes) {
    const match = imageList.find((image) => image?.size === size && image?.["#text"]);
    if (match?.["#text"]) return match["#text"];
  }

  return imageList.find((image) => image?.["#text"])?.["#text"] ?? null;
};

const getTextValue = (value) => {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    return value["#text"] ?? value.name ?? value.text ?? null;
  }
  return null;
};

const normalizeRecentTrack = (track, index) => ({
  rank: index + 1,
  artist: getTextValue(track?.artist),
  title: track?.name ?? null,
  track: track?.name ?? null,
  album: getTextValue(track?.album),
  image: getImageUrl(track?.image),
  url: track?.url ?? null,
  playedAt: track?.date?.["#text"] ?? null,
  playedAtUnix: track?.date?.uts ?? null,
  nowPlaying: track?.["@attr"]?.nowplaying === "true",
  duration: track?.duration ?? null,
  playcount: track?.playcount ?? null,
});

const normalizeTrack = (track, index) => ({
  rank: Number(track?.["@attr"]?.rank ?? index + 1),
  artist: getTextValue(track?.artist),
  title: track?.name ?? null,
  track: track?.name ?? null,
  album: getTextValue(track?.album),
  image: getImageUrl(track?.image),
  url: track?.url ?? null,
  duration: track?.duration ?? null,
  playcount: track?.playcount ?? null,
});

const normalizeArtist = (artist, index) => ({
  rank: Number(artist?.["@attr"]?.rank ?? index + 1),
  artist: artist?.name ?? getTextValue(artist?.artist),
  name: artist?.name ?? getTextValue(artist?.artist),
  image: getImageUrl(artist?.image),
  url: artist?.url ?? null,
  playcount: artist?.playcount ?? null,
});

const normalizeAlbum = (album, index) => ({
  rank: Number(album?.["@attr"]?.rank ?? index + 1),
  artist: getTextValue(album?.artist),
  album: album?.name ?? null,
  title: album?.name ?? null,
  image: getImageUrl(album?.image),
  url: album?.url ?? null,
  playcount: album?.playcount ?? null,
});

const normalizeFriend = (friend, index) => ({
  rank: index + 1,
  name: friend?.name ?? null,
  realname: friend?.realname ?? null,
  country: friend?.country ?? null,
  playcount: friend?.playcount ?? null,
  image: getImageUrl(friend?.image),
  url: friend?.url ?? null,
});

const fetchLastFm = async (method, params = {}) => {
  try {
    const response = await axios.get(LASTFM_API_URL, {
      params: {
        api_key: LASTFM_API_KEY,
        format: "json",
        method,
        user: LASTFM_USERNAME,
        ...params,
      },
    });

    return response.data;
  } catch (error) {
    console.error(
      `Last.fm request failed for ${method}:`,
      error.response?.data?.message || error.message
    );
    return null;
  }
};

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

app.get("/spotify/getStats", async (_req, res) => {
  try {
    const [
      recentTracksData,
      topTracksWeekData,
      topTracksMonthData,
      topTracksAllTimeData,
      topArtistsWeekData,
      topArtistsMonthData,
      topArtistsAllTimeData,
      topAlbumsWeekData,
      topAlbumsMonthData,
      topAlbumsAllTimeData,
      weeklyTrackChartData,
      weeklyArtistChartData,
      weeklyAlbumChartData,
      userInfoData,
      friendsData,
    ] = await Promise.all([
      fetchLastFm("user.getrecenttracks", { limit: 50 }),
      fetchLastFm("user.gettoptracks", { period: "7day", limit: 50 }),
      fetchLastFm("user.gettoptracks", { period: "1month", limit: 50 }),
      fetchLastFm("user.gettoptracks", { period: "overall", limit: 50 }),
      fetchLastFm("user.gettopartists", { period: "7day", limit: 50 }),
      fetchLastFm("user.gettopartists", { period: "1month", limit: 50 }),
      fetchLastFm("user.gettopartists", { period: "overall", limit: 50 }),
      fetchLastFm("user.gettopalbums", { period: "7day", limit: 50 }),
      fetchLastFm("user.gettopalbums", { period: "1month", limit: 50 }),
      fetchLastFm("user.gettopalbums", { period: "overall", limit: 50 }),
      fetchLastFm("user.getweeklytrackchart"),
      fetchLastFm("user.getweeklyartistchart"),
      fetchLastFm("user.getweeklyalbumchart"),
      fetchLastFm("user.getinfo"),
      fetchLastFm("user.getfriends"),
    ]);

    const recentTracks = recentTracksData
      ? toArray(recentTracksData?.recenttracks?.track).map(normalizeRecentTrack)
      : null;
    const topTracksWeek = topTracksWeekData
      ? toArray(topTracksWeekData?.toptracks?.track).map(normalizeTrack)
      : null;
    const topTracksMonth = topTracksMonthData
      ? toArray(topTracksMonthData?.toptracks?.track).map(normalizeTrack)
      : null;
    const topTracksAllTime = topTracksAllTimeData
      ? toArray(topTracksAllTimeData?.toptracks?.track).map(normalizeTrack)
      : null;
    const topArtistsWeek = topArtistsWeekData
      ? toArray(topArtistsWeekData?.topartists?.artist).map(normalizeArtist)
      : null;
    const topArtistsMonth = topArtistsMonthData
      ? toArray(topArtistsMonthData?.topartists?.artist).map(normalizeArtist)
      : null;
    const topArtistsAllTime = topArtistsAllTimeData
      ? toArray(topArtistsAllTimeData?.topartists?.artist).map(normalizeArtist)
      : null;
    const topAlbumsWeek = topAlbumsWeekData
      ? toArray(topAlbumsWeekData?.topalbums?.album).map(normalizeAlbum)
      : null;
    const topAlbumsMonth = topAlbumsMonthData
      ? toArray(topAlbumsMonthData?.topalbums?.album).map(normalizeAlbum)
      : null;
    const topAlbumsAllTime = topAlbumsAllTimeData
      ? toArray(topAlbumsAllTimeData?.topalbums?.album).map(normalizeAlbum)
      : null;
    const weeklyTrackChart = weeklyTrackChartData
      ? toArray(weeklyTrackChartData?.weeklytrackchart?.track).map(normalizeTrack)
      : null;
    const weeklyArtistChart = weeklyArtistChartData
      ? toArray(weeklyArtistChartData?.weeklyartistchart?.artist).map(normalizeArtist)
      : null;
    const weeklyAlbumChart = weeklyAlbumChartData
      ? toArray(weeklyAlbumChartData?.weeklyalbumchart?.album).map(normalizeAlbum)
      : null;
    const friends = friendsData
      ? toArray(friendsData?.friends?.user).map(normalizeFriend)
      : null;

    const userInfo = userInfoData?.user ?? null;
    const user = userInfo
      ? {
          name: userInfo.name ?? LASTFM_USERNAME,
          playcount: userInfo.playcount ?? null,
          country: userInfo.country ?? null,
          registered: userInfo.registered?.unixtime ?? userInfo.registered?.["#text"] ?? null,
          age: userInfo.age ?? null,
          gender: userInfo.gender ?? null,
          subscriber: userInfo.subscriber ?? null,
          image: getImageUrl(userInfo.image),
        }
      : null;

    const nowPlaying =
      recentTracks?.find((track) => track.nowPlaying) ??
      null;

    res.json({
      user,
      nowPlaying: nowPlaying
        ? {
            artist: nowPlaying.artist,
            track: nowPlaying.track,
            album: nowPlaying.album,
            image: nowPlaying.image,
          }
        : null,
      recentTracks,
      topTracksWeek,
      topTracksMonth,
      topTracksAllTime,
      topArtistsWeek,
      topArtistsMonth,
      topArtistsAllTime,
      topAlbumsWeek,
      topAlbumsMonth,
      topAlbumsAllTime,
      weeklyTrackChart,
      weeklyArtistChart,
      weeklyAlbumChart,
      friends,
    });
  } catch (error) {
    console.error("Last.fm stats aggregation failed:", error.message);
    res.status(500).json({ error: "Failed to fetch Last.fm stats" });
  }
});

// Health check
app.get("/", (req, res) => res.send("News backend running ✅"));

app.listen(PORT, () => console.log(`News backend listening on port ${PORT}`));
