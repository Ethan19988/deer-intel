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
  // What the animal is doing (e.g. "Chasing", "Feeding", "Traveling"), else "".
  behavior: string;
  // Behavior-led hunting read of what was seen (e.g. "Chasing — mature buck
  // pushing a doe, rut movement"), else "".
  animalNotes: string;
  // When the buck matches one of the property's saved deer profiles: the
  // profile's id and how sure the match is; both "" when no match.
  matchedProfileId: string;
  matchConfidence: "" | "possible" | "likely";
};

// What the client sends so vision can recognize individual bucks: the saved
// deer profiles' names and distinguishing characteristics.
export type KnownBuckSummary = {
  id: string;
  name: string;
  description: string;
};

export type PhotoStampStatusResponse = {
  configured: boolean;
};

export type PhotoStampErrorResponse = {
  error: string;
};
