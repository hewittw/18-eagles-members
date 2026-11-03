// Who flies a callsign: the first three letters of an airline callsign are its ICAO designator (AAL1234 = American).
// A static map of the operators a golfer is likely to see around US and golf-trip airports: mainline and regional
// airlines, cargo, and the business-jet fleets (NetJets, Flexjet…) that fly into the Monterey and Hilton Heads of the
// world. Pure (no Deno or npm imports), so the Node tests import it. Unknown designators give null, never a guess.

export const AIRLINES: Readonly<Record<string, string>> = {
  // US mainline and low-cost
  AAL: "American", UAL: "United", DAL: "Delta", SWA: "Southwest", ASA: "Alaska", JBU: "JetBlue", NKS: "Spirit",
  FFT: "Frontier", HAL: "Hawaiian", SCX: "Sun Country", AAY: "Allegiant", MXY: "Breeze", VXP: "Avelo",
  // US regionals (they fly as American Eagle, United Express, Delta Connection…)
  ENY: "Envoy", SKW: "SkyWest", RPA: "Republic", JIA: "PSA", GJS: "GoJet", EDV: "Endeavor", ASH: "Mesa",
  PDT: "Piedmont", QXE: "Horizon", AWI: "Air Wisconsin", CPZ: "Compass", UCA: "CommutAir", KAP: "Cape Air",
  // Cargo
  FDX: "FedEx", UPS: "UPS", GTI: "Atlas Air", ABX: "ABX Air", ATN: "Air Transport Intl", CKS: "Kalitta",
  BOX: "AeroLogic", CLX: "Cargolux", GEC: "Lufthansa Cargo", PAC: "Polar", SOO: "Southern Air", AJT: "Amerijet",
  WGN: "Western Global", MTN: "Mountain Air Cargo", CAO: "Air China Cargo",
  // Business aviation
  EJA: "NetJets", LXJ: "Flexjet", EJM: "Executive Jet Mgmt", XOJ: "XOJET", TWY: "Solairus", JRE: "JetReady",
  VJA: "Vista America", VJT: "VistaJet", WUP: "Wheels Up", GPD: "Tradewind", JTZ: "Jet Linx", FWK: "Flight Works",
  // Canada and Mexico
  ACA: "Air Canada", JZA: "Jazz", ROU: "Air Canada Rouge", WJA: "WestJet", TSC: "Air Transat", POE: "Porter",
  FLE: "Flair", AMX: "Aeroméxico", VIV: "Viva Aerobus", VOI: "Volaris",
  // Europe
  BAW: "British Airways", VIR: "Virgin Atlantic", EIN: "Aer Lingus", RYR: "Ryanair", EZY: "easyJet", LOG: "Loganair",
  DLH: "Lufthansa", AFR: "Air France", KLM: "KLM", IBE: "Iberia", TAP: "TAP Portugal", SWR: "Swiss", AUA: "Austrian",
  SAS: "SAS", FIN: "Finnair", ICE: "Icelandair", THY: "Turkish", ITY: "ITA Airways", LOT: "LOT", BEL: "Brussels",
  // Middle East, Asia, Oceania, Africa, Latin America
  UAE: "Emirates", QTR: "Qatar", ETD: "Etihad", SVA: "Saudia", ELY: "El Al", JAL: "Japan Airlines", ANA: "ANA",
  KAL: "Korean Air", AAR: "Asiana", CPA: "Cathay Pacific", SIA: "Singapore", EVA: "EVA Air", CAL: "China Airlines",
  CCA: "Air China", CES: "China Eastern", CSN: "China Southern", QFA: "Qantas", ANZ: "Air New Zealand",
  VOZ: "Virgin Australia", SAA: "South African", ETH: "Ethiopian", AVA: "Avianca", CMP: "Copa", LAN: "LATAM",
  TAM: "LATAM Brasil", AZU: "Azul",
};

/** A US civil registration used as a callsign (N6052C, N828WW): a private or charter flight. */
const N_NUMBER = /^N[1-9][0-9A-Z]{0,4}$/;
/** An airline callsign: three letters, then the flight number (AAL1234, EJA401, BAW2K). */
const AIRLINE_CALLSIGN = /^([A-Z]{3})[0-9][0-9A-Z]{0,4}$/;

/** "AAL1234" → "American", "N6052C" → "Private", an unknown designator or no callsign → null. */
export function airlineFor(callsign: string | null | undefined): string | null {
  const c = String(callsign ?? "").trim().toUpperCase();
  if (!c) return null;
  if (N_NUMBER.test(c)) return "Private";
  const m = AIRLINE_CALLSIGN.exec(c);
  return m ? AIRLINES[m[1]] ?? null : null;
}

/** Operators a golfer can't buy a seat on (cargo, fractional and charter jets): never worth a route lookup. */
export const NOT_PASSENGER: ReadonlySet<string> = new Set([
  "FDX", "UPS", "GTI", "ABX", "ATN", "CKS", "BOX", "CLX", "GEC", "PAC", "SOO", "AJT", "WGN", "MTN", "CAO",
  "EJA", "LXJ", "EJM", "XOJ", "TWY", "JRE", "VJA", "VJT", "WUP", "GPD", "JTZ", "FWK",
]);

/**
 * "AAL1234" → true: an airline-looking callsign (three letters, then a flight number) from an operator that sells
 * seats. N-numbers, cargo and business jets are false; they never fly a golfer's route.
 */
export function isAirlineCallsign(callsign: string | null | undefined): boolean {
  const c = String(callsign ?? "").trim().toUpperCase();
  const m = AIRLINE_CALLSIGN.exec(c);
  return !!m && /^[A-Z]{3}[0-9]{1,4}[A-Z]{0,2}$/.test(c) && !NOT_PASSENGER.has(m[1]);
}
