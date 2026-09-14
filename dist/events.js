// Olympic event registry.
// TRACK/84 began as one arcade discipline (110m hurdles). Extra events plug
// into the same deterministic 120 Hz engine, the same L/R/J input protocol and
// the same five-lane multiplayer room, so nothing in the net layer changes.
export const EVENTS = [
  {
    id: 'hurdles',
    name: '110m Hurdles',
    icon: '🏃',
    blurb: 'Sprint 110m · clear 10 hurdles',
    caption: 'HURDLES',
    meta: '10 HURDLES',
    // The stage's real stadium name is used for the track event.
    venueLabel: '',
    action: 'JUMP',
    actionSub: 'CLEAR IT',
    hint: 'L ↔ R alternate to run / J time your jump',
    running: true,
  },
  {
    id: 'rowing',
    name: '500m Single Sculls',
    icon: '🚣',
    blurb: 'Row 500m · rhythm + sprint ×2',
    caption: 'STROKES',
    meta: '500m SPRINT',
    venueLabel: 'Olympic Regatta Course',
    action: 'SPRINT',
    actionSub: '×2',
    hint: 'L ↔ R alternate oars / J sprint — twice a race',
    running: false,
  },
];

export const DEFAULT_EVENT = 'hurdles';

export function isEvent(id) { return EVENTS.some(e => e.id === id); }
export function getEvent(id) { return EVENTS.find(e => e.id === id) ?? EVENTS[0]; }
export function eventIds() { return EVENTS.map(e => e.id); }

// Rowing tuning: 500m sprint on flat water. Strokes build hull speed exactly
// like running builds cadence, but the boat rewards rhythm and punishes a
// smashed rating: steady strokes ride clean water ("swing"), while rowing above
// the sustainable rating burns stamina and a stuck oar catches a crab.
export const ROWING = Object.freeze({
  distance: 500,
  maxSpeed: 17,          // m/s at full rating, fresh legs (arcade shell)
  base: 4.0,             // hull speed with no strokes at all (a shell glides)
  perCadence: 1.7,       // m/s gained per stroke per second
  accel: 0.24,           // how quickly the hull settles onto its target
  accelMin: 0.05,
  accelMax: 1.0,
  decel: 0.3,            // drag pulling an over-rated hull back down
  glideDrag: 0.5,        // boats coast: light drag between strokes
  stallDrag: 3.5,        // ...but a dead stroke rate lets the hull stall
  stallAfter: 0.7,       // seconds of silence before the hull bites
  cruise: 6.0,           // strokes/sec a crew can hold for the whole race
  strokeMax: 9,          // rating that counts as full gas
  drainPerSec: 0.075,    // stamina lost per second at full gas over cruise
  recoverPerSec: 0.09,   // stamina regained per second while rating under cruise
  staminaFloor: 0.35,    // below this the hull digs in
  staminaPenalty: 0.42,  // speed factor lost at empty stamina
  swingCv: 0.22,         // interval spread (sd/mean) that still counts as steady
  swingBonus: 0.09,      // clean-water speed bonus
  crabRepeats: 3,        // same-side strokes in a row that catch a crab
  crabDuration: 0.95,
  crabSpeed: 0.22,
  powerCharges: 2,       // POWER TEN calls per race
  powerDuration: 3,
  powerBoost: 0.16,
  powerDrain: 1.6,       // stamina cost multiplier while surging
  falseStartLock: 1.2,   // seconds the boat is held after a false start
});

export function distanceFor(eventId) {
  return eventId === 'rowing' ? ROWING.distance : 110;
}