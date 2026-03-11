const express = require("express");
const cors = require("cors");
const axios = require("axios");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;
const LAST_FM_BASE_URL = "http://ws.audioscrobbler.com/2.0/";
const LAST_FM_API_KEY = "6ec77ebf567c251f40a5bc2b16b225a9";
const LAST_FM_USERNAME = "DhruvinSrkr";

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

const pickLastFmImage = (images) => {
  const imageList = toArray(images);
  return (
    imageList.find((entry) => entry?.size === "extralarge")?.["#text"] ||
    imageList.find((entry) => entry?.size === "large")?.["#text"] ||
    imageList.find((entry) => entry?.size === "medium")?.["#text"] ||
    imageList.find((entry) => entry?.["#text"])?.["#text"] ||
    null
  );
};

const parseRank = (value, fallback) => {
  const rank = Number(value);
  return Number.isFinite(rank) ? rank : fallback;
};

const normalizeTrack = (track, index) => ({
  rank: parseRank(track?.["@attr"]?.rank, index + 1),
  artist:
    track?.artist?.name ??
    track?.artist?.["#text"] ??
    track?.artist ??
    null,
  title: track?.name ?? null,
  album: track?.album?.["#text"] ?? track?.album?.name ?? track?.album ?? null,
  playcount: track?.playcount != null ? Number(track.playcount) : null,
  duration: track?.duration != null ? Number(track.duration) : null,
  image: pickLastFmImage(track?.image),
  url: track?.url ?? null,
  nowPlaying: track?.["@attr"]?.nowplaying === "true",
  playedAt: track?.date?.uts ?? null,
});

const normalizeArtist = (artist, index) => ({
  rank: parseRank(artist?.["@attr"]?.rank, index + 1),
  name: artist?.name ?? null,
  playcount: artist?.playcount != null ? Number(artist.playcount) : null,
  image: pickLastFmImage(artist?.image),
  url: artist?.url ?? null,
});

const normalizeAlbum = (album, index) => ({
  rank: parseRank(album?.["@attr"]?.rank, index + 1),
  artist:
    album?.artist?.name ??
    album?.artist?.["#text"] ??
    album?.artist ??
    null,
  name: album?.name ?? null,
  playcount: album?.playcount != null ? Number(album.playcount) : null,
  image: pickLastFmImage(album?.image),
  url: album?.url ?? null,
});

const normalizeFriend = (friend, index) => ({
  rank: parseRank(friend?.["@attr"]?.rank, index + 1),
  name: friend?.name ?? null,
  realname: friend?.realname ?? null,
  country: friend?.country ?? null,
  playcount: friend?.playcount != null ? Number(friend.playcount) : null,
  image: pickLastFmImage(friend?.image),
  url: friend?.url ?? null,
});

const fetchLastFm = async (label, params) => {
  try {
    const response = await axios.get(LAST_FM_BASE_URL, {
      params: {
        api_key: LAST_FM_API_KEY,
        format: "json",
        user: LAST_FM_USERNAME,
        ...params,
      },
    });

    return response.data;
  } catch (error) {
    console.error(`Last.fm ${label} failed:`, error.message);
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

// GET /spotify/getStats
// Returns Last.fm activity and listening stats for the Spotify desktop app.
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
      fetchLastFm("recent tracks", {
        method: "user.getrecenttracks",
        limit: 50,
      }),
      fetchLastFm("top tracks week", {
        method: "user.gettoptracks",
        period: "7day",
        limit: 50,
      }),
      fetchLastFm("top tracks month", {
        method: "user.gettoptracks",
        period: "1month",
        limit: 50,
      }),
      fetchLastFm("top tracks overall", {
        method: "user.gettoptracks",
        period: "overall",
        limit: 50,
      }),
      fetchLastFm("top artists week", {
        method: "user.gettopartists",
        period: "7day",
        limit: 50,
      }),
      fetchLastFm("top artists month", {
        method: "user.gettopartists",
        period: "1month",
        limit: 50,
      }),
      fetchLastFm("top artists overall", {
        method: "user.gettopartists",
        period: "overall",
        limit: 50,
      }),
      fetchLastFm("top albums week", {
        method: "user.gettopalbums",
        period: "7day",
        limit: 50,
      }),
      fetchLastFm("top albums month", {
        method: "user.gettopalbums",
        period: "1month",
        limit: 50,
      }),
      fetchLastFm("top albums overall", {
        method: "user.gettopalbums",
        period: "overall",
        limit: 50,
      }),
      fetchLastFm("weekly track chart", {
        method: "user.getweeklytrackchart",
      }),
      fetchLastFm("weekly artist chart", {
        method: "user.getweeklyartistchart",
      }),
      fetchLastFm("weekly album chart", {
        method: "user.getweeklyalbumchart",
      }),
      fetchLastFm("user info", {
        method: "user.getinfo",
      }),
      fetchLastFm("friends", {
        method: "user.getfriends",
      }),
    ]);

    const recentTracks = recentTracksData
      ? toArray(recentTracksData.recenttracks?.track).map(normalizeTrack)
      : null;

    const nowPlayingTrack =
      recentTracks?.find((track) => track.nowPlaying) ?? null;

    const userSource = userInfoData?.user ?? null;

    res.json({
      user: userSource
        ? {
            name: userSource.name ?? null,
            playcount:
              userSource.playcount != null ? Number(userSource.playcount) : null,
            country: userSource.country ?? null,
            registered:
              userSource.registered?.unixtime ??
              userSource.registered?.["#text"] ??
              null,
            image: pickLastFmImage(userSource.image),
          }
        : null,
      nowPlaying: nowPlayingTrack
        ? {
            artist: nowPlayingTrack.artist,
            track: nowPlayingTrack.title,
            album: nowPlayingTrack.album,
            image: nowPlayingTrack.image,
          }
        : null,
      recentTracks,
      topTracksWeek: topTracksWeekData
        ? toArray(topTracksWeekData.toptracks?.track).map(normalizeTrack)
        : null,
      topTracksMonth: topTracksMonthData
        ? toArray(topTracksMonthData.toptracks?.track).map(normalizeTrack)
        : null,
      topTracksAllTime: topTracksAllTimeData
        ? toArray(topTracksAllTimeData.toptracks?.track).map(normalizeTrack)
        : null,
      topArtistsWeek: topArtistsWeekData
        ? toArray(topArtistsWeekData.topartists?.artist).map(normalizeArtist)
        : null,
      topArtistsMonth: topArtistsMonthData
        ? toArray(topArtistsMonthData.topartists?.artist).map(normalizeArtist)
        : null,
      topArtistsAllTime: topArtistsAllTimeData
        ? toArray(topArtistsAllTimeData.topartists?.artist).map(normalizeArtist)
        : null,
      topAlbumsWeek: topAlbumsWeekData
        ? toArray(topAlbumsWeekData.topalbums?.album).map(normalizeAlbum)
        : null,
      topAlbumsMonth: topAlbumsMonthData
        ? toArray(topAlbumsMonthData.topalbums?.album).map(normalizeAlbum)
        : null,
      topAlbumsAllTime: topAlbumsAllTimeData
        ? toArray(topAlbumsAllTimeData.topalbums?.album).map(normalizeAlbum)
        : null,
      weeklyTrackChart: weeklyTrackChartData
        ? toArray(weeklyTrackChartData.weeklytrackchart?.track).map(normalizeTrack)
        : null,
      weeklyArtistChart: weeklyArtistChartData
        ? toArray(weeklyArtistChartData.weeklyartistchart?.artist).map(
            normalizeArtist
          )
        : null,
      weeklyAlbumChart: weeklyAlbumChartData
        ? toArray(weeklyAlbumChartData.weeklyalbumchart?.album).map(normalizeAlbum)
        : null,
      friends: friendsData
        ? toArray(friendsData.friends?.user).map(normalizeFriend)
        : null,
    });
  } catch (error) {
    console.error("Spotify stats aggregation error:", error.message);
    res.status(500).json({ error: "Failed to fetch Last.fm stats" });
  }
});

// Health check
app.get("/", (req, res) => res.send("News backend running ✅"));

app.listen(PORT, () => console.log(`News backend listening on port ${PORT}`));
