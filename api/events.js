const { google } = require("googleapis");

function getStartOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday as start of week
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getEndOfWeek(startOfWeek) {
  const d = new Date(startOfWeek);
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
}

function parseEvent(event) {
  const title = event.summary || "";
  const regex = /^CV Install\s*-\s*(.+?)\s*\+\s*(.+)$/i;
  const match = title.match(regex);

  const start = event.start.dateTime || event.start.date;
  const end = event.end.dateTime || event.end.date;

  if (match) {
    return {
      time: match[1].trim(),
      project: match[2].trim(),
      date: start,
      endDate: end,
      raw: title,
    };
  }

  return {
    time: null,
    project: title.replace(/^CV Install\s*-?\s*/i, "").trim() || title,
    date: start,
    endDate: end,
    raw: title,
  };
}

module.exports = async function handler(req, res) {
  try {
    const privateKey = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n");

    const auth = new google.auth.JWT(
      process.env.GOOGLE_CLIENT_EMAIL,
      null,
      privateKey,
      ["https://www.googleapis.com/auth/calendar.readonly"]
    );

    const calendar = google.calendar({ version: "v3", auth });

    const now = new Date();
    const weekStart = getStartOfWeek(now);
    const weekEnd = getEndOfWeek(weekStart);

    const response = await calendar.events.list({
      calendarId: process.env.GOOGLE_CALENDAR_ID,
      timeMin: weekStart.toISOString(),
      timeMax: weekEnd.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
    });

    const allEvents = response.data.items || [];

    const cvEvents = allEvents
      .filter((e) => (e.summary || "").toLowerCase().includes("cv install"))
      .map(parseEvent);

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(200).json({
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
      events: cvEvents,
    });
  } catch (error) {
    console.error("Error fetching calendar events:", error);
    res.status(500).json({ error: "Failed to fetch events" });
  }
};
