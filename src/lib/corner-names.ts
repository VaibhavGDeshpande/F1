// Traditional corner names by OpenF1 circuit_key → FIA corner number. No data feed has these, so this is maintained by
// hand. Only well-established names are listed; anything missing just shows its number. Numbers follow the current
// FIA layout (checked against MultiViewer's corner counts). Re-check a circuit when its layout changes.
export const CORNER_NAMES: Record<number, Record<number, string>> = {
  // Silverstone
  2: {
    1: "Abbey", 2: "Farm", 3: "Village", 4: "The Loop", 5: "Aintree", 6: "Brooklands", 7: "Luffield", 8: "Woodcote", 9: "Copse",
    10: "Maggotts", 11: "Maggotts", 12: "Becketts", 13: "Becketts", 14: "Chapel", 15: "Stowe", 16: "Vale", 17: "Club", 18: "Club",
  },
  // Monza
  39: {
    1: "Variante del Rettifilo", 2: "Variante del Rettifilo", 3: "Curva Grande", 4: "Variante della Roggia", 5: "Variante della Roggia",
    6: "Lesmo 1", 7: "Lesmo 2", 8: "Variante Ascari", 9: "Variante Ascari", 10: "Variante Ascari", 11: "Parabolica",
  },
  // Spa-Francorchamps
  7: {
    1: "La Source", 2: "Eau Rouge", 3: "Raidillon", 4: "Raidillon", 5: "Les Combes", 6: "Les Combes", 7: "Les Combes", 8: "Bruxelles",
    10: "Pouhon", 11: "Pouhon", 12: "Fagnes", 13: "Fagnes", 15: "Stavelot", 17: "Blanchimont", 18: "Bus Stop", 19: "Bus Stop",
  },
  // Monaco
  22: {
    1: "Sainte Dévote", 2: "Beau Rivage", 3: "Massenet", 4: "Casino", 5: "Mirabeau Haute", 6: "Grand Hotel Hairpin", 7: "Mirabeau Bas",
    8: "Portier", 9: "Tunnel", 10: "Nouvelle Chicane", 11: "Nouvelle Chicane", 12: "Tabac", 13: "Louis Chiron", 14: "Louis Chiron",
    15: "Piscine", 16: "Piscine", 17: "Rascasse", 18: "Rascasse", 19: "Anthony Noghès",
  },
  // Suzuka
  46: {
    1: "First Curve", 2: "First Curve", 3: "S Curves", 4: "S Curves", 5: "S Curves", 6: "S Curves", 7: "Dunlop", 8: "Degner 1",
    9: "Degner 2", 11: "Hairpin", 12: "200R", 13: "Spoon", 14: "Spoon", 15: "130R", 16: "Casio Triangle", 17: "Casio Triangle",
  },
  // Interlagos
  14: {
    1: "Senna S", 2: "Senna S", 3: "Curva do Sol", 4: "Descida do Lago", 5: "Descida do Lago", 6: "Ferradura", 7: "Ferradura",
    8: "Laranjinha", 9: "Pinheirinho", 10: "Bico de Pato", 11: "Mergulho", 12: "Junção", 13: "Subida dos Boxes", 14: "Subida dos Boxes",
    15: "Subida dos Boxes",
  },
  // Zandvoort
  55: { 1: "Tarzan", 2: "Gerlach", 3: "Hugenholtz", 7: "Scheivlak", 14: "Arie Luyendyk" },
  // Montreal
  23: { 1: "Virage Senna", 2: "Virage Senna", 10: "L'Épingle", 13: "Final chicane", 14: "Wall of Champions" },
  // Imola
  6: {
    2: "Tamburello", 3: "Tamburello", 4: "Tamburello", 5: "Villeneuve", 6: "Villeneuve", 7: "Tosa", 9: "Piratella",
    11: "Acque Minerali", 12: "Acque Minerali", 13: "Acque Minerali", 14: "Variante Alta", 15: "Variante Alta", 17: "Rivazza", 18: "Rivazza",
  },
  // Spielberg
  19: { 1: "Niki Lauda", 3: "Remus" },
};

export const cornerName = (circuitKey: number, n: number) => CORNER_NAMES[circuitKey]?.[n];
