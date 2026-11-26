// Car facts that are public and stable: the 2026 rules every car is built to, each team's chassis and power unit, and
// the one full spec sheet a team publishes. Hand-kept per season (sources next to each block); detailed part specs
// (dimensions, materials, power figures) are team secrets and are deliberately not guessed here.

export const SOURCES = {
  rules: { label: "formula1.com: 12 rule changes for 2026", url: "https://www.formula1.com/en/latest/article/from-smaller-cars-to-a-bigger-budget-cap-12-rule-changes-you-need-to-know-about-in.56uUTFhB0z5j3iZfhC0rGP" },
  w17: { label: "Mercedes-AMG F1: W17 technical specifications", url: "https://www.mercedesamgf1.com/f1-w17-2026-technical-specifications" },
  entry: { label: "The Race: 2026 entry list, chassis and engines", url: "https://www.the-race.com/formula-1/f1-2026-entry-list-driver-numbers-chassis-engines/" },
};

export type SpecRow = { group: string; item: string; value: string; note?: string; source: keyof typeof SOURCES };

/** What every 2026 car shares, because the FIA technical regulations fix it. */
export const RULES_2026: SpecRow[] = [
  { group: "Size & weight", item: "Minimum weight", value: "768 kg", note: "down from 800 kg in 2025", source: "rules" },
  { group: "Size & weight", item: "Wheelbase", value: "3,400 mm max", note: "200 mm shorter than 2025", source: "rules" },
  { group: "Size & weight", item: "Overall width", value: "1,900 mm", note: "floor 100 mm narrower", source: "w17" },
  { group: "Size & weight", item: "Tyres", value: "Pirelli", note: "fronts 25 mm and rears 30 mm narrower than 2025", source: "rules" },
  { group: "Aerodynamics", item: "Floor", value: "Venturi tunnels removed", note: "wheel covers gone, bargeboards back", source: "rules" },
  { group: "Aerodynamics", item: "Active aero", value: "Straight Mode", note: "front and rear wing flaps open together on designated straights (dry only)", source: "rules" },
  { group: "Aerodynamics", item: "Overtake Mode", value: "+0.5 MJ extra energy", note: "replaces DRS; one detection point per lap", source: "rules" },
  { group: "Power unit", item: "Engine", value: "1.6 L V6 turbo hybrid", note: "90° bank, 24 valves, 15,000 rpm limit", source: "w17" },
  { group: "Power unit", item: "Combustion engine power", value: "≈ 400 kW", source: "rules" },
  { group: "Power unit", item: "MGU-K (electric motor)", value: "350 kW", note: "up from 120 kW: roughly a 50/50 split with the engine", source: "rules" },
  { group: "Power unit", item: "MGU-H", value: "Removed", source: "rules" },
  { group: "Power unit", item: "Energy recovered per lap", value: "up to 9 MJ", note: "circuit specific; more than double 2025's 4 MJ", source: "w17" },
  { group: "Power unit", item: "Fuel", value: "Advanced sustainable fuel", note: "max fuel flow 3,000 MJ/h (energy, not mass)", source: "w17" },
  { group: "Power unit", item: "Season allocation (per driver)", value: "4 ICE, turbo, exhaust · 3 MGU-K, battery, control electronics", source: "w17" },
];

/** Chassis and power unit per team (formula1.com image slug → car). */
export const CARS_2026: Record<string, { chassis: string; pu: string }> = {
  mclaren: { chassis: "MCL40", pu: "Mercedes" },
  mercedes: { chassis: "W17", pu: "Mercedes" },
  redbullracing: { chassis: "RB22", pu: "Red Bull Ford" },
  ferrari: { chassis: "SF-26", pu: "Ferrari" },
  williams: { chassis: "FW48", pu: "Mercedes" },
  racingbulls: { chassis: "VCARB 03", pu: "Red Bull Ford" },
  astonmartin: { chassis: "AMR26", pu: "Honda" },
  haasf1team: { chassis: "VF-26", pu: "Ferrari" },
  audi: { chassis: "R26", pu: "Audi" },
  alpine: { chassis: "A526", pu: "Mercedes" },
  cadillac: { chassis: "MAC-26", pu: "Ferrari" },
};

/** The full spec sheet a team publishes itself (only Mercedes does for 2026 so far), quoted as published. */
export const TEAM_SHEETS: Record<string, { item: string; value: string }[]> = {
  mercedes: [
    { item: "Monocoque", value: "Moulded carbon fibre and honeycomb composite structure" },
    { item: "Front suspension", value: "Carbon fibre wishbone and push rod-activated springs and dampers" },
    { item: "Rear suspension", value: "Carbon fibre wishbone and push rod-activated inboard springs & dampers" },
    { item: "Gearbox", value: "Eight speed forward, one reverse unit with carbon fibre main case" },
    { item: "Gear selection", value: "Sequential, semi-automatic, hydraulic activation" },
    { item: "Clutch", value: "Carbon plate" },
    { item: "Brakes", value: "Carbone Industries carbon/carbon discs and pads with rear brake-by-wire" },
    { item: "Brake calipers", value: "Brembo monobloc, nickel-plated aluminium alloy (front and rear)" },
    { item: "Wheels", value: "OZ forged magnesium" },
    { item: "Steering", value: "Power-assisted rack and pinion" },
    { item: "Electronics", value: "FIA standard ECU and FIA homologated electronic and electrical system" },
    { item: "Fuel system", value: "ATL Kevlar-reinforced rubber bladder" },
    { item: "Dimensions", value: "Length under 5,505 mm · width 1,900 mm · height 970 mm · weight 772 kg" },
    { item: "Power unit", value: "Mercedes-AMG F1 M17 E PERFORMANCE, minimum weight 185 kg" },
    { item: "Turbo", value: "Single-stage compressor and exhaust turbine on a common shaft, max 150,000 rpm" },
    { item: "Fuel injection", value: "High-pressure direct injection (max 350 bar, one injector per cylinder)" },
    { item: "Battery", value: "Lithium-ion, max 4.0 MJ usable on track" },
    { item: "MGU-K", value: "350 kW max, 60,000 rpm max" },
  ],
};

/** Component name as teams write it → the area of the car it belongs to. */
const AREAS: [RegExp, string][] = [
  [/front wing|endplate|nose/i, "Front wing & nose"],
  [/rear wing|beam wing/i, "Rear wing"],
  [/diffuser/i, "Diffuser"],
  [/floor/i, "Floor"],
  [/sidepod|coke|engine cover|cooling|louvre|inlet/i, "Sidepods & cooling"],
  [/front corner|front suspension|front brake/i, "Front corner"],
  [/rear corner|rear suspension|rear brake|drum/i, "Rear corner"],
  [/halo|mirror|bodywork|cockpit/i, "Bodywork"],
];
export const carArea = (component: string) => AREAS.find(([re]) => re.test(component))?.[1] ?? "Other";
export const AREA_ORDER = ["Front wing & nose", "Floor", "Diffuser", "Sidepods & cooling", "Bodywork", "Front corner", "Rear corner", "Rear wing", "Other"];
