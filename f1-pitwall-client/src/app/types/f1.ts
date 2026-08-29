// ─── Shared TypeScript interfaces for F1 Pitwall ─────────────────────────────
// Single source of truth — import from here instead of redefining locally.

/* ── Driver (full career stats — used by /drivers) ─────────────────────── */
export interface DriverCareer {
  id: number;
  name: string;
  carNumber: number;
  nationality: string;
  careerPoints: number;
  careerWins: number;
  careerPoles: number;
  team: DriverTeamRef;
}

export interface DriverTeamRef {
  id: number;
  name: string;
  colorHex: string;
}

/* ── Driver (lightweight — used by /teams) ──────────────────────────────── */
export interface DriverCard {
  id: number;
  name: string;
  carNumber: number;
  nationality: string;
  team?: { name: string };
}

/* ── Driver (results editing — used by /races/[id]/results) ─────────────── */
export interface DriverRef {
  id: number;
  name: string;
  carNumber: number;
  team: { name: string; colorHex: string };
}

/* ── Driver ratings (GET /api/drivers/profiles) ─────────────────────────── */

export interface DriverSkills {
  pace: number;
  racecraft: number;
  tyreMgmt: number;
  experience: number;
  wetSkill: number;
  overall: number;
}

/** How much real data backs each rating, 0–100. Low values mean the rating leans on the baseline. */
export interface DriverConfidence {
  pace: number;
  racecraft: number;
  tyreMgmt: number;
  experience: number;
  wetSkill: number;
}

/** The measurements behind the ratings. `null` means there was no data for that measure. */
export interface DriverEvidence {
  teammateName: string | null;

  qualifyingSessions: number;
  qualifyingHeadToHeadSessions: number;
  qualifyingH2HPct: number | null;
  teammateGapPct: number | null;
  avgQualifyingPosition: number | null;

  racesStarted: number;
  racesClassified: number;
  finishRatePct: number | null;
  avgPositionsGained: number | null;
  raceH2HPct: number | null;
  avgFinishPosition: number | null;

  pitStops: number;
  avgPitStopSec: number | null;
  avgStopsPerRace: number | null;
  fieldAvgStopsPerRace: number | null;
  degradationSecPerLap: number | null;
  fieldDegradationSecPerLap: number | null;
  stintsAnalysed: number;

  wetRaces: number;
  wetAvgFinish: number | null;
  dryAvgFinish: number | null;

  confidence: DriverConfidence;
}

export interface DriverProfile {
  driverId: number;
  name: string;
  carNumber: number;
  nationality: string;
  teamName: string | null;
  teamColorHex: string | null;
  age: number | null;
  careerWins: number;
  careerPoles: number;
  careerPoints: number;
  season: number;
  skills: DriverSkills;
  evidence: DriverEvidence;
}

/* ── Team livery (GET /api/teams/livery) ────────────────────────────────── */
export interface TeamLivery {
  id: number;
  name: string;
  country: string;
  colorHex: string | null;
  accentHex: string | null;
  engineSupplier: string | null;
  carName: string | null;
  teamPrincipal: string | null;
  base: string | null;
  championships: number;
  foundedYear: number;
  annualBudgetM: number;
  drivers: { id: number; name: string; carNumber: number; nationality: string }[];
}

/* ── Pit stop benchmark (GET /api/races/pit-stops/benchmark/{season}) ───── */
export interface PitStopBenchmark {
  season: number;
  totalStops: number;
  greenFlagStops: number;
  fastestSec: number | null;
  medianSec: number | null;
  meanSec: number | null;
  topQuartileSec: number | null;
  fastest: {
    id: number;
    durationSec: number;
    lapNumber: number;
    driverName: string;
    driverNumber: number;
    teamName: string;
    teamColor: string;
    raceName: string;
    round: number;
    tyreOut: string | null;
    underSafetyCar: boolean;
  }[];
  crews: {
    teamName: string;
    teamColor: string;
    stops: number;
    medianSec: number | null;
    bestSec: number | null;
  }[];
}

/* ── Team (constructor) ─────────────────────────────────────────────────── */
export interface TeamInfo {
  id: number;
  name: string;
  country: string;
  colorHex: string;
  championships: number;
  annualBudgetM: number;
  base: string;
  foundedYear: number;
}

/* ── Circuit ────────────────────────────────────────────────────────────── */
export interface CircuitInfo {
  id: number;
  name: string;
  country: string;
  city: string;
  type: CircuitType;
  totalLaps: number;
  lengthKm: number;
  lapRecordSec: number;
  lapRecordHolder: string;
  turnCount: number;
}

export type CircuitType = "PERMANENT" | "STREET" | "OVAL";

/* ── Circuit 3D geometry (GET /api/circuits/{id}/geometry) ──────────────── */

/** Where the racing line came from — the UI must show this, the three differ in accuracy. */
export type GeometrySource = "OPENF1" | "GEOJSON" | "SYNTHETIC";

/**
 * A racing line ready for 3D rendering. Each point is `[x, y, z]`: `x`/`z` are plan-view
 * coordinates normalised to [-1, 1] with the true aspect ratio kept, and `y` is elevation in
 * metres above the lowest point of the lap — the renderer scales `y` itself.
 */
export interface CircuitGeometry {
  circuitId: number;
  circuitName: string;
  country: string;
  city: string | null;
  source: GeometrySource;
  sourceLabel: string;
  hasRealElevation: boolean;
  points: [number, number, number][];
  pointCount: number;
  spanXM: number | null;
  spanZM: number | null;
  elevationMinM: number | null;
  elevationMaxM: number | null;
  elevationGainM: number | null;
  measuredLengthKm: number | null;
  lengthKm: number;
  turnCount: number;
  drsZones: number | null;
  totalLaps: number;
  firstGpYear: number | null;
  direction: "CLOCKWISE" | "ANTI_CLOCKWISE" | null;
  lapRecordSec: number;
  lapRecordHolder: string | null;
  openf1SessionKey: number | null;
  openf1DriverNumber: number | null;
  openf1LapNumber: number | null;
  fetchedAt: string | null;
}

/* ── Circuit (lightweight — used by strategy simulator) ─────────────────── */
export interface CircuitRef {
  id: number;
  name: string;
  totalLaps: number;
  lapRecordSec: number;
  country: string;
}

/* ── Race ───────────────────────────────────────────────────────────────── */
export interface RaceInfo {
  id: number;
  name: string;
  season: number;
  roundNumber: number;
  date: string;
  status: "SCHEDULED" | "COMPLETED" | "CANCELLED" | "ONGOING";
  circuit: CircuitRef;
}
export type RaceData = RaceInfo;

/* ── Driver standings ───────────────────────────────────────────────────── */
export interface DriverStanding {
  position: number;
  driverId: number;
  driverName: string;
  carNumber: number;
  nationality: string;
  teamName: string;
  teamColor: string;
  totalPoints: number;
  wins: number;
  podiums: number;
  fastestLaps: number;
  gapToLeader: number;
  gapToAhead: number;
}

/* ── Constructor standings ──────────────────────────────────────────────── */
export interface ConstructorStanding {
  position: number;
  teamId: number;
  teamName: string;
  teamColor: string;
  country: string;
  totalPoints: number;
  wins: number;
  podiums: number;
  gapToLeader: number;
  driver1Name: string;
  driver2Name: string;
  driver1Points: number;
  driver2Points: number;
}

/* ── Race results ───────────────────────────────────────────────────────── */
export interface ResultRow {
  driverId: number;
  driverName: string;
  teamName: string;
  teamColor: string;
  carNumber: number;
  startPosition: number;
  finishPosition: number;
  hasFastestLap: boolean;
  fastestLapTime: number;
  dnfReason: string;
}

export interface RaceResultResponse {
  id: number;
  finishPosition: number;
  driverName: string;
  teamName: string;
  teamColor: string;
  points: number;
  hasFastestLap: boolean;
  dnfReason: string;
}

/* ── Qualifying ─────────────────────────────────────────────────────────── */
export interface QualifyingResult {
  id: number;
  driverId: number;
  gridPosition: number;
  qualifyingPosition: number;
  driverName: string;
  teamName: string;
  teamColor: string;
  carNumber: number;
  q1Time: string | null;
  q2Time: string | null;
  q3Time: string | null;
  bestTime: string | null;
  eliminatedQ1: boolean;
  eliminatedQ2: boolean;
  q1TimeRaw: number | null;
  q2TimeRaw: number | null;
  q3TimeRaw: number | null;
}

/* ── Penalty ──────────────────────────────────────────────────────────── */
export interface PenaltyItem {
  id: number;
  type: string;
  timeSeconds: number;
  gridDrop: number;
  reason: string;
  lap: number;
  driverId: number;
  driverName: string;
  carNumber: number;
  teamName: string;
}

/* ── Race weekend sessions + results ────────────────────────────────────── */
export interface SessionInfo {
  sessionKey: number;
  name: string;
  type: string;
  dateStart: string;
  dateEnd: string;
}

export interface SessionResult {
  position: number;
  driverNumber: number;
  driverName: string;
  teamName: string;
  teamColor: string;
  nameAcronym: string;
  fastestLap: number;
  avgLap: number;
  lapsCompleted: number;
}

/* ── Race weekend widget ────────────────────────────────────────────────── */
export interface WidgetSession {
  sessionKey: number;
  name: string;
  dateStart: string;
  dateEnd: string;
  status: "LIVE" | "UPCOMING" | "COMPLETED";
  startsIn?: number;
  endsIn?: number;
}

export interface WeekendData {
  countryName: string;
  circuitName: string;
  sessions: WidgetSession[];
  currentSession: WidgetSession | null;
  nextSession: WidgetSession | null;
  error?: string;
}

/* ── Telemetry ──────────────────────────────────────────────────────────── */
export interface TelemetryData {
  driverName: string;
  teamName: string;
  teamColor: string;
  carNumber: number;
  lap: number;
  speed: number;
  rpm: number;
  gear: number;
  throttle: number;
  brake: number;
  drsActive: boolean;
  fuelLoad: number;
  tyreType: string;
  tyreTemp: number;
  lapTime: number;
  gap: number;
  position: number;
  timestamp: number;
}

export interface LiveTyreData {
  driverNumber: number;
  driverName: string;
  teamName: string;
  teamColor: string;
  tyreCompound: string;
  tyreAge: number;
  lapStart: number;
  stintNumber: number;
  position: number;
  isLive: boolean;
  sessionName: string;
}

export interface LiveStatus {
  isLive: boolean;
  sessionKey?: string | number;
  sessionName: string;
  sessionType: string;
  circuitName: string;
  countryName: string;
  sessionEmoji: string;
  driversCount: number;
}

/* ── Notifications ──────────────────────────────────────────────────────── */
export interface NotificationItem {
  id: number;
  type: string;
  title: string;
  message: string;
  icon: string;
  read: boolean;
  createdAt: string;
}

/* ── Admin ──────────────────────────────────────────────────────────────── */
export type UserRole = "ADMIN" | "ENGINEER" | "VIEWER";

export interface AdminUser {
  id: number;
  username: string;
  email: string;
  role: UserRole;
}

export interface AdminStats {
  totalUsers: number;
  totalDrivers: number;
  totalTeams: number;
  totalRaces: number;
  totalRaceResults: number;
  totalNotifications: number;
  unreadNotifications: number;
  usersByRole: { ADMIN: number; ENGINEER: number; VIEWER: number };
}

export interface SyncResult {
  synced: string[];
  skipped: string[];
  errors: string[];
  total: number;
}

/* ── Race winner (by GP name) ───────────────────────────────────────────── */
export interface RaceWinner {
  driver: string;
  team: string;
}

/* ── Session event timeline ─────────────────────────────────────────────── */
export interface PitStopEvent {
  id: number;
  driverName: string;
  teamName: string;
  teamColor: string;
  lap: number;
  tyreCompound: string;
  durationMs: number;
}

export interface RaceIncident {
  id: number;
  lap: number;
  driverName: string;
  teamName: string;
  type: "RETIREMENT" | "ACCIDENT" | "YELLOW_FLAG" | "RED_FLAG" | "SAFETY_CAR" | "VIRTUAL_SAFETY_CAR";
  description: string;
}

export interface WeatherChange {
  lap: number;
  condition: "DRY" | "WET" | "INTERMEDIATE" | "MIXED";
  trackTempC: number;
}

export type TimelineEvent =
  | { kind: "pit-stop"; lap: number; data: PitStopEvent }
  | { kind: "incident"; lap: number; data: RaceIncident }
  | { kind: "weather"; lap: number; data: WeatherChange }
  | { kind: "fastest-lap"; lap: number; driverName: string; teamColor: string; time: number };

/* ── Race news ──────────────────────────────────────────────────────────── */
export interface RaceNewsItem {
  id: number;
  title: string;
  content: string;
  tag: string | null;
  createdAt: string | null;
  raceId: number;
  raceName: string;
  roundNumber: number;
  season: number;
  raceDate: string | null;
}
