// The data a trail camera prints onto a photo's info bar, read by vision.
export type PhotoStamp = {
  // Capture moment as "YYYY-MM-DDTHH:mm" (or "YYYY-MM-DD" if no time), else "".
  dateTime: string;
  // Temperature as a plain number string in the requested unit, else "".
  temperature: string;
  // Moon phase as printed (e.g. "Waning gibbous"), else "".
  moonPhase: string;
};

export type PhotoStampStatusResponse = {
  configured: boolean;
};

export type PhotoStampErrorResponse = {
  error: string;
};
