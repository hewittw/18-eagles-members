// Where each built-in course is, and its OpenGolfAPI id, so weather and "Course facts" never depend on a fuzzy
// name search at runtime. Looked up once by hand on 2026-10-26 with GET /api/v1/courses/search?q=<name>&state=<XX>
// (OpenGolfAPI, © OpenStreetMap contributors, ODbL 1.0), choosing the entry that is the same course.
// `openGolfId: null` = OpenGolfAPI has no entry for it; those coordinates are from the club's own address
// (Royal Dornoch, Royal Troon, the Old Course) or corrected where OpenGolfAPI's pin is off (Jackson Park).
export type CourseGeo = { lat: number; lng: number; openGolfId: string | null };

export const COURSE_GEO: Record<string, CourseGeo> = {
  "augusta-national": { lat: 33.4959, lng: -82.0233, openGolfId: "9b0c9a02-fb5a-4f55-9a0b-0c7a664675e6" },
  "bethpage-black": { lat: 40.7541, lng: -73.4402, openGolfId: "1d930d4d-7beb-48e6-9346-f3db01b70172" },
  carnoustie: { lat: 56.4936, lng: -2.7272, openGolfId: "99710f2c-385f-40a4-9a31-029dbb45ee4d" },
  "chambers-bay": { lat: 47.2001, lng: -122.5697, openGolfId: "11e81205-be02-4d73-b0ca-f327ba18013b" },
  "fairbanks-ranch": { lat: 32.9768, lng: -117.2113, openGolfId: "ae3d0ef2-e680-4623-95ec-5bca9b2de60c" },
  "harbour-town": { lat: 32.1363, lng: -80.8098, openGolfId: "25b56a69-913c-4505-8ee2-8534e2130116" },
  "jackson-park": { lat: 41.7800, lng: -87.5770, openGolfId: "0025f00f-c6a4-4b88-9d9b-80989af19af3" },
  "kiawah-ocean": { lat: 32.6125, lng: -80.0226, openGolfId: "2f8238b3-85d2-4d54-b1af-779dec846381" },
  kingsbarns: { lat: 56.2994, lng: -2.6413, openGolfId: "de49eafd-63f7-4492-81de-ce721ba850af" },
  "merion-east": { lat: 40.0022, lng: -75.3121, openGolfId: "f757d86d-9078-4fd1-a288-cbd3f5adc96c" },
  muirfield: { lat: 56.0458, lng: -2.8218, openGolfId: "026a61b6-e92f-45ff-9b70-a83eacd1d9cf" },
  "north-berwick": { lat: 56.0598, lng: -2.7465, openGolfId: "3286dddb-fb46-44cb-a8c6-10acca39dce8" },
  oakmont: { lat: 40.5254, lng: -79.8275, openGolfId: "c8a49dcf-d660-47c3-8636-f5d93648595f" },
  "olympic-lake": { lat: 37.7138, lng: -122.4928, openGolfId: "a130f375-5d85-4f21-9d4f-aec3ca0bcd6c" },
  "pebble-beach": { lat: 36.5685, lng: -121.949, openGolfId: "40977ee8-33ee-4195-b6a2-99a4ca83c2bc" },
  "pinehurst-no-2": { lat: 35.1917, lng: -79.4607, openGolfId: "b25a4e85-561a-4ca4-8028-7c3480c9bbc0" },
  "rancho-santa-fe": { lat: 33.0235, lng: -117.2093, openGolfId: "2721496b-79a6-4564-beec-002bfbf354b9" },
  riviera: { lat: 34.0498, lng: -118.5013, openGolfId: "8ba304eb-006f-48ee-a0e3-d1beeb8984ab" },
  "royal-dornoch": { lat: 57.8806, lng: -4.0233, openGolfId: null },
  "royal-troon": { lat: 55.5317, lng: -4.6497, openGolfId: null },
  "shinnecock-hills": { lat: 40.8942, lng: -72.4388, openGolfId: "07796daa-3132-4229-9a87-9913f16d2699" },
  "st-andrews-old": { lat: 56.3433, lng: -2.8030, openGolfId: null },
  "torrey-pines-north": { lat: 32.9087, lng: -117.249, openGolfId: "2dec10e3-10e8-4262-bfdf-6b2d2d2e4d3e" },
  "torrey-pines-south": { lat: 32.8971, lng: -117.2476, openGolfId: "9b9891db-3b45-48db-892f-149601b79d52" },
  "tpc-sawgrass": { lat: 30.198, lng: -81.3955, openGolfId: "e643ab84-5a52-4bea-b692-a6c884bb536b" },
  "turnberry-ailsa": { lat: 55.3219, lng: -4.8361, openGolfId: "1fa4b0e6-e32d-418f-aa52-25e95d3871a4" },
  "whistling-straits": { lat: 43.8499, lng: -87.7346, openGolfId: "2d201c28-68ec-4897-b7b1-8f19c8984d26" },
  "winged-foot-west": { lat: 40.9577, lng: -73.7535, openGolfId: "c56587f3-8e6d-4c85-b67a-49cec1ed428a" },
};
