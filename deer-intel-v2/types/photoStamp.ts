// What vision reads off a trail-camera photo: the printed info bar plus the
// animal it sees in the frame.
export type PhotoStamp = {
  // Capture moment as "YYYY-MM-DDTHH:mm" (or "YYYY-MM-DD" if no time), else "".
  dateTime: string;
  // Temperature as a plain number string in the requested unit, else "".
  temperature: string;
  // Moon phase as printed (e.g. "Waning gibbous"), else "".
  moonPhase: string;
  // Main animal in the photo as one of the app's species options, else "".
  species: string;
  // Short description of what was seen (e.g. "8-point buck at a scrape"), else "".
  animalNotes: string;
};

export type PhotoStampStatusResponse = {
  configured: boolean;
};

export type PhotoStampErrorResponse = {
  error: string;
};
