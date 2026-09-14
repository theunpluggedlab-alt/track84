// Olympic career stages: every Summer Games from Athens 1896 to Paris 2024.
// Cancelled editions (1916/1940/1944) are skipped, so the order is real history.
// Stage 0 (1896) is EASIEST, stage N-1 (2024) is LEGEND. Difficulty ramps gently.
export const STAGES = [
  { year: 1896, city: 'Athens',      country: 'Greece',        cc: 'GR', code: 'GRE', stadium: 'Panathenaic Stadium',          lat: 37.97, lon: 23.73,  landmark: 'parthenon', flag: 'GR', sky: ['#7db8e8', '#d9ecf7'], stand: ['#e8e2d2', '#c9bfa5'], roof: '#a3352b', accent: '#0d5eaf' },
  { year: 1900, city: 'Paris',       country: 'France',        cc: 'FR', code: 'FRA', stadium: 'Velodrome de Vincennes',      lat: 48.85, lon: 2.35,   landmark: 'eiffel',    flag: 'FR', sky: ['#8fc3ec', '#e3eef7'], stand: ['#d8d5e2', '#a9a7c2'], roof: '#2c3e70', accent: '#002654' },
  { year: 1904, city: 'St. Louis',   country: 'United States', cc: 'US', code: 'USA', stadium: 'Francis Field',               lat: 38.63, lon: -90.20, landmark: 'arch',      flag: 'US', sky: ['#8ec7ef', '#e8f2e2'], stand: ['#d9c9b4', '#a89278'], roof: '#7a1f1f', accent: '#b31942' },
  { year: 1908, city: 'London',      country: 'United Kingdom',cc: 'GB', code: 'GBR', stadium: 'White City Stadium',          lat: 51.50, lon: -0.12,  landmark: 'bigben',    flag: 'GB', sky: ['#9db6c9', '#dfe6ea'], stand: ['#cfc8bd', '#8f8a80'], roof: '#3a3f4a', accent: '#012169' },
  { year: 1912, city: 'Stockholm',   country: 'Sweden',        cc: 'SE', code: 'SWE', stadium: 'Stockholm Olympic Stadium',   lat: 59.33, lon: 18.06,  landmark: 'cityhall',  flag: 'SE', sky: ['#7fb6e6', '#dceefb'], stand: ['#c9a49a', '#8f5f52'], roof: '#5d2b23', accent: '#006aa7' },
  { year: 1920, city: 'Antwerp',     country: 'Belgium',       cc: 'BE', code: 'BEL', stadium: 'Olympisch Stadion',           lat: 51.22, lon: 4.40,   landmark: 'cathedral', flag: 'BE', sky: ['#93bede', '#e2e8ee'], stand: ['#d5cfae', '#9a9370'], roof: '#2b2b2b', accent: '#000000' },
  { year: 1924, city: 'Paris',       country: 'France',        cc: 'FR', code: 'FRA', stadium: 'Stade de Colombes',           lat: 48.93, lon: 2.25,   landmark: 'eiffel',    flag: 'FR', sky: ['#86bce8', '#e8f0e8'], stand: ['#d3d8cf', '#8b917f'], roof: '#1f4d2e', accent: '#0055a4' },
  { year: 1928, city: 'Amsterdam',   country: 'Netherlands',   cc: 'NL', code: 'NED', stadium: 'Olympic Stadium Amsterdam',   lat: 52.34, lon: 4.85,   landmark: 'tower',     flag: 'NL', sky: ['#8cc0ea', '#e4f0f7'], stand: ['#c9b8a4', '#8a6f52'], roof: '#274c77', accent: '#ae1c28' },
  { year: 1932, city: 'Los Angeles', country: 'United States', cc: 'US', code: 'USA', stadium: 'LA Memorial Coliseum',        lat: 34.05, lon: -118.24,landmark: 'palms',     flag: 'US', sky: ['#6fb7f0', '#f7e8c8'], stand: ['#e2d3b3', '#a08c62'], roof: '#7a1f1f', accent: '#b31942' },
  { year: 1936, city: 'Berlin',      country: 'Germany',       cc: 'DE', code: 'GER', stadium: 'Olympiastadion Berlin',       lat: 52.51, lon: 13.24,  landmark: 'gate',      flag: 'DE', sky: ['#8aa8c4', '#d8dde0'], stand: ['#cfc9bb', '#8d8a7a'], roof: '#3f3f3f', accent: '#000000' },
  { year: 1948, city: 'London',      country: 'United Kingdom',cc: 'GB', code: 'GBR', stadium: 'Empire Stadium, Wembley',     lat: 51.56, lon: -0.28,  landmark: 'bigben',    flag: 'GB', sky: ['#93aec6', '#e0e6ea'], stand: ['#d2cbc0', '#8f8a7e'], roof: '#4a2d5d', accent: '#012169' },
  { year: 1952, city: 'Helsinki',    country: 'Finland',       cc: 'FI', code: 'FIN', stadium: 'Helsinki Olympic Stadium',    lat: 60.18, lon: 24.93,  landmark: 'tower72',   flag: 'FI', sky: ['#7cb8ea', '#e2f0fa'], stand: ['#e3e0d5', '#a5a294'], roof: '#2e5f8a', accent: '#002f6c' },
  { year: 1956, city: 'Melbourne',   country: 'Australia',     cc: 'AU', code: 'AUS', stadium: 'Melbourne Cricket Ground',    lat: -37.82, lon: 144.98,landmark: 'mcg',       flag: 'AU', sky: ['#79c1f2', '#f4ecd2'], stand: ['#cfc49a', '#7d744e'], roof: '#1f4d2e', accent: '#00247d' },
  { year: 1960, city: 'Rome',        country: 'Italy',         cc: 'IT', code: 'ITA', stadium: 'Stadio Olimpico',             lat: 41.93, lon: 12.45,  landmark: 'colosseum', flag: 'IT', sky: ['#7dbcf2', '#f7e9c8'], stand: ['#e0d2b0', '#9a8a62'], roof: '#5d2b23', accent: '#009246' },
  { year: 1964, city: 'Tokyo',       country: 'Japan',         cc: 'JP', code: 'JPN', stadium: 'National Olympic Stadium',    lat: 35.68, lon: 139.71, landmark: 'fuji',      flag: 'JP', sky: ['#7cc0f2', '#f2dfe0'], stand: ['#d8d2c8', '#8d8d90'], roof: '#8a1f2d', accent: '#bc002d' },
  { year: 1968, city: 'Mexico City', country: 'Mexico',        cc: 'MX', code: 'MEX', stadium: 'Estadio Olimpico Universitario', lat: 19.33, lon: -99.19, landmark: 'pyramid', flag: 'MX', sky: ['#6fc0f0', '#f7e3b8'], stand: ['#d9b8a0', '#8f5f4a'], roof: '#7a2d1f', accent: '#006847' },
  { year: 1972, city: 'Munich',      country: 'Germany',       cc: 'DE', code: 'FRG', stadium: 'Olympiastadion Munich',       lat: 48.17, lon: 11.55,  landmark: 'tent',      flag: 'DE', sky: ['#84bde8', '#e4edf2'], stand: ['#d5d8de', '#8b93a0'], roof: '#5a6b7a', accent: '#dd0000' },
  { year: 1976, city: 'Montreal',    country: 'Canada',        cc: 'CA', code: 'CAN', stadium: 'Olympic Stadium, Montreal',   lat: 45.56, lon: -73.55, landmark: 'tower175', flag: 'CA', sky: ['#80bdee', '#e8eef4'], stand: ['#d8d5d2', '#8f8c88'], roof: '#5d5d5d', accent: '#ff0000' },
  { year: 1980, city: 'Moscow',      country: 'Soviet Union',  cc: 'SU', code: 'URS', stadium: 'Grand Arena, Luzhniki',       lat: 55.72, lon: 37.55,  landmark: 'kremlin',   flag: 'SU', sky: ['#8ab4d4', '#e0e4e6'], stand: ['#c9b8b0', '#7d5f56'], roof: '#6b1f1f', accent: '#cc0000' },
  { year: 1984, city: 'Los Angeles', country: 'United States', cc: 'US', code: 'USA', stadium: 'LA Memorial Coliseum',        lat: 34.05, lon: -118.24,landmark: 'palms',     flag: 'US', sky: ['#5fb4f2', '#f9e2b8'], stand: ['#e8d0a8', '#9a7f52'], roof: '#0f4c81', accent: '#3c3b6e' },
  { year: 1988, city: 'Seoul',       country: 'South Korea',   cc: 'KR', code: 'KOR', stadium: 'Seoul Olympic Stadium',       lat: 37.52, lon: 127.07, landmark: 'gate88',    flag: 'KR', sky: ['#6fbcf2', '#f2e4c8'], stand: ['#d8cfc0', '#8a7f6e'], roof: '#1f4d7a', accent: '#003478' },
  { year: 1992, city: 'Barcelona',   country: 'Spain',         cc: 'ES', code: 'ESP', stadium: 'Estadi Olimpic de Montjuic',  lat: 41.36, lon: 2.16,   landmark: 'sagrada',   flag: 'ES', sky: ['#62b8f2', '#f7e6b8'], stand: ['#e2c9a8', '#96754e'], roof: '#7a1f1f', accent: '#aa151b' },
  { year: 1996, city: 'Atlanta',     country: 'United States', cc: 'US', code: 'USA', stadium: 'Centennial Olympic Stadium',  lat: 33.74, lon: -84.39, landmark: 'torch',     flag: 'US', sky: ['#66baf2', '#f4e2b8'], stand: ['#d9c9a8', '#8a7552'], roof: '#1f5d2e', accent: '#0a3161' },
  { year: 2000, city: 'Sydney',      country: 'Australia',     cc: 'AU', code: 'AUS', stadium: 'Stadium Australia',           lat: -33.85, lon: 151.06,landmark: 'opera',     flag: 'AU', sky: ['#58b6f2', '#e8f2e8'], stand: ['#d5e0e8', '#7d94a8'], roof: '#0f4c81', accent: '#00843d' },
  { year: 2004, city: 'Athens',      country: 'Greece',        cc: 'GR', code: 'GRE', stadium: 'OAKA Spiros Louis',           lat: 38.04, lon: 23.79,  landmark: 'parthenon', flag: 'GR', sky: ['#64b8f2', '#f7ecd0'], stand: ['#e8e4da', '#9a968a'], roof: '#5a7a9a', accent: '#0d5eaf' },
  { year: 2008, city: 'Beijing',     country: 'China',         cc: 'CN', code: 'CHN', stadium: "Beijing National Stadium",    lat: 39.99, lon: 116.40, landmark: 'nest',      flag: 'CN', sky: ['#5aa8e8', '#f0dcb8'], stand: ['#c9c2b8', '#7a746a'], roof: '#5d5d5d', accent: '#de2910' },
  { year: 2012, city: 'London',      country: 'United Kingdom',cc: 'GB', code: 'GBR', stadium: 'London Olympic Stadium',      lat: 51.54, lon: -0.02,  landmark: 'orbit',     flag: 'GB', sky: ['#6aaede', '#e2e8ee'], stand: ['#d8d2e8', '#7d7690'], roof: '#4a3f6b', accent: '#012169' },
  { year: 2016, city: 'Rio de Janeiro', country: 'Brazil',     cc: 'BR', code: 'BRA', stadium: 'Estadio Nilton Santos',       lat: -22.89, lon: -43.29,landmark: 'christ',    flag: 'BR', sky: ['#4fb8f2', '#f7e8a8'], stand: ['#cfe0b8', '#6f8a52'], roof: '#1f6b3a', accent: '#009b3a' },
  { year: 2020, city: 'Tokyo',       country: 'Japan',         cc: 'JP', code: 'JPN', stadium: 'Japan National Stadium',      lat: 35.68, lon: 139.71, landmark: 'fuji',      flag: 'JP', sky: ['#5ab2ee', '#f2dde0'], stand: ['#d8cbb0', '#7a6f52'], roof: '#4a5d3a', accent: '#bc002d' },
  { year: 2024, city: 'Paris',       country: 'France',        cc: 'FR', code: 'FRA', stadium: 'Stade de France',             lat: 48.92, lon: 2.36,   landmark: 'eiffel',    flag: 'FR', sky: ['#4ea6ec', '#e8dff2'], stand: ['#c9b8d8', '#6b5d8a'], roof: '#2c1f5d', accent: '#002654' },
];

export const STAGE_COUNT = STAGES.length;

// Gentle ramp: big early wins keep players hooked, late stages demand mastery.
// t = 0 (1896, easiest) .. 1 (2024, legend).
export function difficultyFor(index) {
  const t = STAGES.length <= 1 ? 0 : Math.min(1, Math.max(0, index / (STAGES.length - 1)));
  // Slight ease so mid-game plateaus instead of spiking.
  const eased = Math.pow(t, 1.12);
  const meanPace = 4.15 + eased * 3.05;      // avg CPU cadence steps/sec: 4.15 -> 7.20
  const jitter = 1.6 - eased * 0.9;          // AI pace wobble: 1.6 -> 0.7
  const mistake = 0.38 - eased * 0.34;       // AI late-jump blunder rate: 38% -> 4%
  const spread = 0.32 - eased * 0.22;        // AI jump timing spread: 0.32 -> 0.10
  const clearance = 0.68 + eased * 0.23;     // player hurdle forgiveness: 0.68m -> 0.91m
  const idealLo = 0.16 + eased * 0.08;       // jump cue opens earlier on easy stages
  const idealHi = 0.66 - eased * 0.17;       // ...and stays open longer: 0.50s -> 0.25s window
  const lanes = [-0.55, 0.15, 0, -0.15, 0.55].map(o => Math.min(7.8, Math.max(3.2, meanPace + o)));
  const stars = 1 + Math.round(eased * 4);
  const label = t < 0.14 ? 'EASIEST' : t < 0.34 ? 'EASY' : t < 0.55 ? 'MEDIUM' : t < 0.76 ? 'HARD' : t < 0.93 ? 'VERY HARD' : 'LEGEND';
  return { t, eased, meanPace, jitter, mistake, spread, clearance, idealLo, idealHi, lanes, stars, label };
}

export function getStage(index) {
  const i = Math.min(STAGES.length - 1, Math.max(0, index | 0));
  return { ...STAGES[i], index: i, difficulty: difficultyFor(i) };
}

// Equirectangular project for the roadmap world map (viewBox 0 0 360 180).
export function project(lat, lon, w = 360, h = 180) {
  return [((lon + 180) / 360) * w, ((90 - lat) / 180) * h];
}
