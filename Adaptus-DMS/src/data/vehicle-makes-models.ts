// Vehicle Makes and Models data for dropdown selection
// Covers popular car brands commonly used in North America

export interface VehicleMake {
  name: string;
  models: string[];
}

export const vehicleMakes: VehicleMake[] = [
  {
    name: "Acura",
    models: [
      "ILX", "Integra", "MDX", "NSX", "RDX", "RL", "RLX", "RSX", "TL", "TLX", "TSX", "ZDX"
    ]
  },
  {
    name: "Audi",
    models: [
      "A1", "A3", "A4", "A4 Allroad", "A5", "A6", "A7", "A8", "e-tron", "e-tron GT", "Q2", "Q3", "Q4 e-tron", "Q5", "Q6", "Q7", "Q8", "R8", "RS3", "RS4", "RS5", "RS6", "RS7", "S1", "S3", "S4", "S5", "S6", "S7", "S8", "SQ5", "SQ7", "SQ8", "TT"
    ]
  },
  {
    name: "BMW",
    models: [
      "1 Series", "2 Series", "3 Series", "4 Series", "5 Series", "6 Series", "7 Series", "8 Series", "i3", "i4", "i5", "i7", "i8", "iX", "iX1", "iX2", "M1", "M2", "M3", "M4", "M5", "M6", "M8", "X1", "X2", "X3", "X4", "X5", "X6", "X7", "Z3", "Z4", "Z8"
    ]
  },
  {
    name: "Buick",
    models: [
      "Cascada", "Enclave", "Encore", "Encore GX", "Envision", "LaCrosse", "Lucerne", "Regal", "Rendezvous", "Verano"
    ]
  },
  {
    name: "Cadillac",
    models: [
      "ATS", "BLVD", "CT4", "CT5", "CT6", "CTS", "Escalade", "Escalade ESV", "Lyriq", "Optiq", "SRX", "STS", "XT4", "XT5", "XT6", "XTS"
    ]
  },
  {
    name: "Chevrolet",
    models: [
      "Avalanche", "Blazer", "Bolt EV", "Camaro", "Colorado", "Corvette", "Cruze", "Equinox", "Express", "HHR", "Impala", "Malibu", "Monte Carlo", "Nickel", "Oldsmobile", "SS", "Silverado", "Sonic", "Spark", "Suburban", "Tahoe", "Trailblazer", "Traverse", "Trax", "Uplander", "Volt"
    ]
  },
  {
    name: "Chrysler",
    models: [
      "200", "300", "300M", "Aspen", "Cirrus", "Concorde", "Crossfire", "Pacifica", "Prowler", "PT Cruiser", "Sebring", "Town & Country", "Voyager"
    ]
  },
  {
    name: "Dodge",
    models: [
      "Avenger", "Caliber", "Caravan", "Challenger", "Charger", "Dart", "Daytona", "Durango", "Grand Caravan", "Hornet", "Intrepid", "Journey", "Magnum", "Neon", "Nitro", "Ram 1500", "Ram 2500", "Ram 3500", "Ram ProMaster", "Shadow", "SRT Viper", "Stealth", "Stratus", "Viper"
    ]
  },
  {
    name: "Ford",
    models: [
      "Aerostar", "Aspire", "Bronco", "Bronco Sport", "C-Max", "Contour", "Crown Victoria", "E-Transit", "E-Series", "Edge", "Escape", "Escort", "Expedition", "Explorer", "F-150", "F-250", "F-350", "F-450", "F-550", "F-650", "F-750", "Fairlane", "Festiva", "Fiesta", "Five Hundred", "Flex", "Focus", "Freestar", "Freestyle", "Fusion", "Galaxie", "GT", "Lightning", "Maverick", "Mondeo", "Mustang", "Pinto", "Probe", "Ranger", "Roush", "Sedan", "Taurus", "Thunderbird", "Transit", "Transit Connect", "Windstar", "ZX2"
    ]
  },
  {
    name: "GMC",
    models: [
      "Acadia", "Canyon", "Envoy", "Hummer EV", "Hummer EV SUV", "Jimmy", "Sierra", "Sonoma", "Syclone", "Terrain", "Typhoon", "Yukon", "Yukon XL"
    ]
  },
  {
    name: "Honda",
    models: [
      "Accord", "Accord Crosstour", "Acty", "Airwave", "Amaze", "Ascend", "Avancier", "Ballade", "Brio", "BR-V", "Capa", "City", "Civic", "Clarity", " Concerto", "CR-V", "CR-X", "CR-Z", "Crossroad", "Crosstour", "Domani", "Element", "Fit", "Fit EV", "Freed", "HR-V", "Insight", "Inspire", "Integra", "Jade", "Jazz", "Legend", "Life", "Logo", "Mobilio", "N-BOX", "N-One", "N600", "N800", "Odyssey", "Passport", "Pilot", "Prelude", "Ridgeline", "S2000", "S660", "Shuttle", "Stepwgn", "Street", "Stream", "Tornado", "Torneo", "UR-V", "Vezel", "Vigor", "Z"
    ]
  },
  {
    name: "Hyundai",
    models: [
      "Accent", "Atos", "Azera", "Bayon", "Creta", "Elantra", "Entourage", "Eon", "Equus", "Excel", "Galloper", "Genesis", "Grandeur", "H-1", "H100", "H200", "i10", "i20", "i30", "i40", "i50", "Ioniq 5", "Ioniq 6", "Ioniq", "ix20", "ix35", "ix55", "Kona", "LaCasta", "Lantra", "Lavita", "Matrix", "Nexo", "Palisade", "Pony", "Santa Cruz", "Santa Fe", "Santamo", "Sonata", "Starex", "Staria", "Stellar", "Terracan", "Ti", "Trajet", "Tucson", "Tuscan", "Veloster", "Venue", "Veracruz", "Verna", "Xcent", "XG"
    ]
  },
  {
    name: "Infiniti",
    models: [
      "EX25", "EX35", "EX37", "FX35", "FX37", "FX45", "FX50", "G20", "G25", "G35", "G37", "I30", "I35", "J30", "JX35", "M25", "M35", "M37", "M45", "M56", "Q40", "Q45", "Q50", "Q60", "Q70", "QX30", "QX4", "QX50", "QX55", "QX56", "QX60", "QX65", "QX70", "QX80"
    ]
  },
  {
    name: "Jaguar",
    models: [
      "E-Pace", "F-Pace", "F-Type", "I-Pace", "S-Type", "X-Type", "XE", "XF", "XJ", "XJ6", "XJ8", "XK", "XK8", "XKR"
    ]
  },
  {
    name: "Jeep",
    models: [
      "Cherokee", "Comanche", "Commander", "Compass", "Gladiator", "Grand Cherokee", "Grand Wagoneer", "Liberty", "Patriot", "Renegade", "Scrambler", "Wagoneer", "Willys", "Wrangler"
    ]
  },
  {
    name: "Kia",
    models: [
      "Amanti", "Borrego", "Cadenza", "Carnival", "Ceed", "Cerato", "Forte", "K3", "K5", "K7", "K8", "K9", "K900", "Magentis", "Mohave", "Niro", "Niro EV", "Optima", "Picanto", "Pride", "Rio", "Rondo", "Sedona", "Seltos", "Sorento", "Soul", "Soul EV", "Spectra", "Sportage", "Stinger", "Telluride", "Titan", "Towners", "Visto", "Xceed"
    ]
  },
  {
    name: "Land Rover",
    models: [
      "Defender", "Discovery", "Discovery Sport", "Freelander", "Range Rover", "Range Rover Evoque", "Range Rover Sport", "Range Rover Velar", "Series I", "Series II", "Series III"
    ]
  },
  {
    name: "Lexus",
    models: [
      "CT", "CT 200h", "ES", "ES 250", "ES 300", "ES 300h", "ES 330", "ES 350", "GS", "GS 200t", "GS 300", "GS 350", "GS 400", "GS 430", "GS 450h", "GS 460", "GX", "GX 460", "GX 470", "HS", "HS 250h", "IS", "IS 200t", "IS 250", "IS 300", "IS 350", "IS 500", "LC", "LC 500", "LFA", "LM", "LS", "LS 350", "LS 400", "LS 430", "LS 460", "LS 500", "LS 600h", "LX", "LX 450", "LX 470", "LX 500d", "LX 570", "LX 600", "NX", "NX 200t", "NX 300", "NX 300h", "NX 350", "NX 450h+", "RC", "RC 200t", "RC 300", "RC 350", "RC F", "RX", "RX 200t", "RX 300", "RX 330", "RX 350", "RX 400h", "RX 450h", "RX 500h", "RZ", "SC", "SC 300", "SC 400", "SC 430", "UX", "UX 200", "UX 250h", "UX 300e"
    ]
  },
  {
    name: "Lincoln",
    models: [
      "Aviator", "Blackwood", "Briarwood", "Continental", "Corsair", "LS", "Mark", "Mark LT", "MKC", "MKS", "MKT", "MKX", "MKZ", "Nautilus", "Navigator", "Premiere", "Town Car", "Versailles", "Zephyr"
    ]
  },
  {
    name: "Mazda",
    models: [
      "121", "2", "3", "3 Sport", "323", "5", "6", "626", "929", "B-Series", "BT-50", "CX-3", "CX-30", "CX-4", "CX-5", "CX-50", "CX-60", "CX-7", "CX-8", "CX-9", "CX-30", "CX-90", "Demio", "GLC", "MPV", "MX-3", "MX-30", "MX-5 Miata", "MX-6", "Navajo", "Premacy", "Protege", "Protege5", "RX-7", "RX-8", "Tribute"
    ]
  },
  {
    name: "Mercedes-Benz",
    models: [
      "190", "A-Class", "AMG GT", "B-Class", "C-Class", "C 63", "CL", "CLA", "CLA 45", "CLC", "CLK", "CLS", "E-Class", "E 53", "E 63", "G-Class", "GL", "GLA", "GLB", "GLC", "GLE", "GLK", "GLS", "M-Class", "Maybach", "ML", "R-Class", "S-Class", "S 63", "SL", "SLC", "SLK", "SLR", "SLS", "V-Class", "Viano", "Vito", "X-Class"
    ]
  },
  {
    name: "Mitsubishi",
    models: [
      "3000GT", "Adventure", "Airtrek", "ASX", "Attrage", "Brazo", "Carisma", "Challenger", "Chariot", "Colt", "Cordia", "Delica", "Diamante", "Dion", "Eclipse", "Eclipse Cross", "Endeavor", "Evolution", "Galant", "Grandis", "i-MiEV", "L200", "L300", "L400", "Lancer", "Lancer Evolution", "Lancer Sportback", "Legnum", "Libero", "Minica", "Minicab", "Mirage", "Montero", "Montero Sport", "Nativa", "Outlander", "Outlander PHEV", "Pajero", "Pajero Mini", "Pajero Pinin", "Pajero Sport", "Precis", "Proudia", "Raider", "RVR", "Savrin", "Sigma", "Space Gear", "Space Runner", "Space Star", "Space Wagon", "Starion", "Strada", "Triton", "Veryta", "Xpander"
    ]
  },
  {
    name: "Nissan",
    models: [
      "200SX", "240SX", "300ZX", "350Z", "350Z Roadster", "370Z", "Altima", "Armada", "Ariya", "Axess", "Bluebird", "Cabstar", "Caravan", "Cargo", "Cedric", "Chestnut", "Clarion", "Clipper", "Cube", "Dualis", "Echo", "Elgrand", "Frontier", "Fuga", "GT-R", "Hypermini", "Infiniti", "Juke", "Kicks", "King Cab", "Kix", "Laurel", "Leaf", "Liberty", "Livina", "March", "Maxima", "Micra", "Murano", "Navara", "Note", "NP200", "NP300", "NT100", "NV", "NV100", "NV150", "NV200", "NV250", "NV350", "Pathfinder", "Patrol", "Pickup", "Pixo", "Platina", "Pod", "President", "Primastar", "Primera", "Pulsar", "Qashqai", "Qashqai+2", "Quest", "R-nesse", "R32 GT-R", "R33 GT-R", "R34 GT-R", "Rasheen", "Rena", "Rogue", "Rogue Sport", "Ruby", "Safari", "Sentra", "Serena", "Silvia", "Skyline", "Skyline Crossover", "Stanza", "Sunny", "Sylphy", "Teana", "Terrano", "Tiida", "Titan", "Tinta", "Townstar", "Trade", "Urvan", "Van", "Versa", "Versa Note", "X-Terra", "X-Trail", "Xanavi", "Z24", "Z32", "Z34"
    ]
  },
  {
    name: "Oldsmobile",
    models: [
      "Achieva", "Alero", "Aurora", "Bravada", "Custom Cruiser", "Cutlass", "Cutlass Calais", "Cutlass Ciera", "Cutlass Cruiser", "Cutlass Salon", "Cutlass Supreme", "Eighty-Eight", "Fiero", "Firebird", "Forty-Eight", "Golden Rocket", "Intrigue", "LSS", "Ninety-Eight", "Omega", "Profile", "Regency", "Silhouette", "Starfire", "Super 88", "Toronado", "Vista Cruiser"
    ]
  },
  {
    name: "Peugeot",
    models: [
      "1007", "106", "107", "108", "2008", "201", "202", "203", "204", "205", "206", "207", "208", "3008", "301", "304", "305", "306", "307", "308", "4007", "4008", "402", "403", "404", "405", "406", "407", "408", "5008", "504", "505", "508", "601", "604", "605", "607", "806", "807", "Partner", "Ranch", "RCZ"
    ]
  },
  {
    name: "Porsche",
    models: [
      "356", "718 Boxster", "718 Cayman", "911", "912", "914", "918 Spyder", "924", "928", "944", "968", "966", "Carrera GT", "Cayenne", "Cayman", "Macan", "Panamera", "Taycan"
    ]
  },
  {
    name: "Ram",
    models: [
      "1500", "1500 Classic", "2500", "3500", "4500", "5500", "Cargo Van", "ProMaster", "ProMaster City"
    ]
  },
  {
    name: "Saab",
    models: [
      "9-2X", "9-3", "9-4X", "9-5", "9-7X", "900", "9000", "Sonett"
    ]
  },
  {
    name: "Saturn",
    models: [
      "Aura", "Ion", "L-Series", "Outlook", "Relay", "Sky", "Vue"
    ]
  },
  {
    name: "Scion",
    models: [
      "FR-S", "iM", "iQ", "tC", "xA", "xB", "xD"
    ]
  },
  {
    name: "Subaru",
    models: [
      "1000", "1400", "1600", "360", "500", "800", "900", "Alcyone", "Baja", "BRAT", "BRZ", "Crosstrek", "Dex", "Exiga", "Forester", "Impreza", "Justy", "Legacy", "Leone", "Levorg", "Liberty", "Outback", "Pleo", "R1", "R2", "Rex", "Sambar", "Sedan", "STI", "SVX", "Tribeca", "Trezia", "Vivio", "WRX", "WRX STI", "XT", "XV"
    ]
  },
  {
    name: "Suzuki",
    models: [
      "Aerio", "Alto", "Baleno", "Carry", "Celerio", "Ciaz", "CJ", "Denali", "Ertiga", "Escudo", "Equator", "Every", "Forenza", "Grand Vitara", "Ignis", "Jimny", "Kizashi", "Landy", "Lapin", "Liana", "Maruti", "Metro", "Reno", "Samurai", "Sidekick", "Sierra", "Solio", "Spacia", " Splash", "Swift", "SX4", "TA", "Taylor", "Vitara", "Wagon", "Wagon R+", "X-90", "XL7", "Xposed", "Yamoto", "Z400"
    ]
  },
  {
    name: "Tesla",
    models: [
      "Cybertruck", "Model 3", "Model S", "Model X", "Model Y", "Roadster", "Semi"
    ]
  },
  {
    name: "Toyota",
    models: [
      "4Runner", "86", "Alphard", "Aqua", "Aurion", "Auris", "Avalon", "Avanza", "Avensis", "Avensis Verso", "Aygo", "bB", "Belta", "Blade", "Blizzard", "Brevis", "C-HR", "Calya", "Camry", "Carina", "Celica", "Celica Supra", "Celsior", "Century", "Coaster", "Comfort", "Condor", "Corolla", "Corolla Cross", "Corolla Verso", "Corona", "Cressida", "Crown", "Crown Majesta", "Dyna", "Echo", "Esquire", "Estima", "Etios", "FJ Cruiser", "Fortuner", "FunCargo", "Gaia", "Grand", "Granvia", "GT86", "Harrier", "HiAce", "Highlander", "Hilux", "Hilux Surf", "Innova", "Ipsum", "iQ", "ISIS", "Kluger", "Land Cruiser", "LiteAce", "Lucida", "MasterAce", "Matrix", "Mega Cruiser", "Mirai", "MR2", "Nadia", "Noah", "Opa", "Open Pickup", "Origin", "Paseo", "Passo", "Picnic", "Platz", "Polo", "Premio", "Previa", "Prius", "Prius Alpha", "Prius C", "Prius Plug-in", "Prius V", "ProAce", "Probox", "Progres", "Pronard", "Quantum", "Quick", "Ractis", "Raum", "RAV4", "Reiz", "Rukus", "Rush", "Scepter", "Sequoia", "Sera", "Sienna", "Sienta", "Solara", "Soluna", "Space", "Space Cruiser", "Sparky", "Sports", "Sprinter", "Sprinter Carib", "Starlet", "Succeed", "Supra", "Tacoma", "Tamaraw", "Tarago", "Tazz", "Terios", "Terra", "Touring", "Towns", "Toyo", "Truck", "Tundra", "Urban Cruiser", "Van", "Vanguard", "Vellfire", "Veloz", "Venza", "Verso", "Verso-S", "Vios", "Vista", "Vitz", "Voltz", "Voxy", "Wigo", "Windom", "Wish", "Xtrail", "Yaris", "Yaris Cross", "Zelas"
    ]
  },
  {
    name: "Volkswagen",
    models: [
      "Amarok", "Arteon", "Atlas", "Atlas Cross Sport", "Beetle", "Bora", "Caddy", "California", "Caravelle", "CC", "Crafter", "CrossFox", "Derby", "Eos", "Eurovan", "Fox", "Gol", "Golf", "Golf Alltrack", "Golf R", "Golf SportWagen", "Golf Variant", "Grand California", "ID.3", "ID.4", "ID.5", "ID.6", "ID.7", "ID.Buzz", "Jetta", "Kombi", "Laiv", "Lupo", "Multivan", "New Beetle", "Parati", "Passat", "Passat Variant", "Polo", "Polo GTI", "Polo Sedan", "Quantum", "Routan", "Santana", "Saveiro", "Scirocco", "Sharan", "SpaceFox", "T-Cross", "T-Roc", "Taigo", "Tayron", "Teramont", "Tharu", "Tiguan", "Tiguan Allspace", "Touareg", "Touran", "Transporter", "Up!", "Vento", "Virtus", "Voyage"
    ]
  },
  {
    name: "Volvo",
    models: [
      "C30", "C40", "C70", "C70 II", "EX30", "EX40", "EX90", "S40", "S60", "S60 Cross Country", "S70", "S80", "S90", "S90 Recharge", "V40", "V40 Cross Country", "V50", "V60", "V60 Cross Country", "V70", "V90", "V90 Cross Country", "XC30", "XC40", "XC50", "XC60", "XC70", "XC90", "XC90 Recharge"
    ]
  }
];

// Helper function to get models for a specific make
export const getModelsForMake = (makeName: string): string[] => {
  const make = vehicleMakes.find(
    m => m.name.toLowerCase() === makeName.toLowerCase()
  );
  return make ? make.models : [];
};

// Helper function to get all make names
export const getAllMakes = (): string[] => {
  return vehicleMakes.map(m => m.name);
};

// Current year for validation
export const currentYear = new Date().getFullYear();
export const yearRange = Array.from(
  { length: currentYear - 1900 + 2 },
  (_, i) => currentYear + 1 - i
);
