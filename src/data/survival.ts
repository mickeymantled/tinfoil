/**
 * Field Manual TH-72: grid-down preparedness.
 *
 * RULE: everything in `briefing`, `timeline` and `checklist` is plain, factual
 * guidance traceable to Ready.gov (FEMA), the American Red Cross, EPA, CDC,
 * FoodSafety.gov or CISA. The conspiracy voice lives only in `codename`,
 * `intro` and `marginNote`. Do not add facts from memory.
 *
 * Checklist ids are persisted in localStorage. Keep them stable; renaming an id
 * silently unchecks that item for returning visitors.
 */

export interface ChecklistItem {
  id: string;
  label: string;
  detail?: string;
}

export type BriefingBlock =
  | { kind: 'p'; text: string }
  | { kind: 'list'; heading?: string; ordered?: boolean; items: string[] }
  | { kind: 'warning'; title: string; text?: string; items?: string[] }
  | { kind: 'table'; caption: string; headers: string[]; rows: string[][]; note?: string };

export interface TimelinePhase {
  label: string;
  items: string[];
}

export interface SurvivalSection {
  id: string;
  number: number;
  title: string;
  codename: string;
  intro: string;
  marginNote?: string;
  timeline?: TimelinePhase[];
  briefing: BriefingBlock[];
  checklist: ChecklistItem[];
}

export const SURVIVAL_SECTIONS: SurvivalSection[] = [
  {
    id: 'first-72-hours',
    number: 1,
    title: 'First 72 hours',
    codename: 'OPERATION LIGHTS OUT',
    intro:
      'The grid does not fail. It gets switched off. What you do in the first hour decides whether you are a statistic or a footnote.',
    marginNote: 'the fridge stays SHUT. they count the openings.',
    timeline: [
      {
        label: 'First minutes',
        items: [
          'Use flashlights, not candles. Candles are a fire risk.',
          'Keep the refrigerator and freezer doors closed.',
          'Disconnect appliances and electronics so a power surge does not damage them when the power comes back.',
          'Leave one light switched on so you know when the power returns.',
          'Turn on a battery-powered or hand-crank radio for emergency alerts and instructions from local officials.',
        ],
      },
      {
        label: 'First hours',
        items: [
          'Check in with family by text rather than by phone call. Networks get congested in a disaster.',
          'Save phone battery: lower the screen brightness, use low-power or airplane mode, and close apps you are not using.',
          'A closed refrigerator keeps food safe for up to about 4 hours. A full freezer holds its temperature for about 48 hours (about 24 hours if half full).',
          'If you use a generator, run it outdoors only, at least 20 feet from windows, doors and attached garages.',
          'If anyone depends on refrigerated medicine or a powered medical device, put your plan for it into action now.',
          'If the heat or cold is extreme, check with local officials about heating and cooling locations, or go to a community location that has power.',
        ],
      },
      {
        label: 'Days 1 to 3',
        items: [
          'Throw out refrigerated perishable food (meat, poultry, fish, eggs, leftovers) after 4 hours without power, and any perishable food that has been above 40°F for more than 2 hours. Never taste food to decide if it is safe.',
          'Drink the water you need today. Do not ration drinking water unless authorities tell you to.',
          'Treat any water of uncertain quality before you drink it, cook with it or brush your teeth with it.',
          'If the power has been out for a day or more, discard refrigerated medication unless the label says otherwise, and contact your doctor or pharmacist for a new supply.',
          'Watch for signs of carbon monoxide poisoning, heat illness and hypothermia (see Sections 04 and 08).',
          'Stay away from downed power lines. Treat dark traffic signals as an all-way stop.',
          'Expect scams. Urgent "emergency" messages asking you to move money or sign something are a red flag.',
        ],
      },
    ],
    briefing: [
      {
        kind: 'p',
        text: 'This section is the short version. The sections that follow explain each step and list what to have ready before anything happens.',
      },
    ],
    checklist: [
      {
        id: 'h72-kit-spot',
        label: 'Kept the emergency kit in one place everyone in the household knows',
        detail: 'Somewhere you can reach in the dark.',
      },
      {
        id: 'h72-unplug',
        label: 'Know which appliances and electronics to unplug when the power goes out',
        detail: 'Protects them from a surge when power returns.',
      },
      {
        id: 'h72-home-phone',
        label: 'Found out whether our home phone works without power',
      },
      {
        id: 'h72-centers',
        label: 'Know how to find local heating and cooling locations',
        detail: 'Check with local officials or your local health department.',
      },
      {
        id: 'h72-fridge-rule',
        label: 'Everyone knows the rule: fridge and freezer stay closed in an outage',
      },
      {
        id: 'h72-printed',
        label: 'Printed this field manual and stored it with the kit',
        detail: 'A website is no help when the network is down.',
      },
    ],
  },

  {
    id: 'water',
    number: 2,
    title: 'Water',
    codename: 'PROJECT AQUIFER',
    intro:
      'They put something in it. We are not saying what. Store your own and you will never have to find out.',
    marginNote: '1 gallon. per person. per day. do the math BEFORE they do.',
    briefing: [
      {
        kind: 'p',
        text: 'Store at least one gallon of water per person per day, for drinking and sanitation. The Red Cross recommends a 3-day supply for evacuation and a 2-week supply for home. Aim for 2 weeks.',
      },
      {
        kind: 'p',
        text: 'Store more for children, nursing mothers, people who are sick, and anyone in a hot climate. Pets need extra water too.',
      },
      {
        kind: 'list',
        heading: 'Storage',
        items: [
          'Commercially bottled water: keep it sealed in its original container, in a cool, dark place.',
          'Water you bottle yourself: use food-grade water storage containers that have been cleaned and sanitized.',
          'Replace water that is not commercially bottled every six months.',
        ],
      },
      {
        kind: 'warning',
        title: 'Do not ration drinking water',
        text: 'Unless authorities tell you to, drink the amount you need today and look for more tomorrow.',
      },
      {
        kind: 'p',
        text: 'Treat water of uncertain quality before you use it for drinking, cooking, brushing teeth, washing dishes or making ice. If it is cloudy, let particles settle or strain it through a clean cloth or coffee filter first.',
      },
      {
        kind: 'list',
        heading: 'Purify by boiling (best option)',
        ordered: true,
        items: [
          'Bring the water to a rolling boil for one full minute. Above 5,000 feet, boil for three minutes.',
          'Let it cool before drinking.',
        ],
      },
      {
        kind: 'list',
        heading: 'Purify with bleach (only if you cannot boil)',
        ordered: true,
        items: [
          'Use regular, unscented liquid chlorine bleach labeled 6% or 8.25% sodium hypochlorite, stored for less than a year.',
          'Add the number of drops in the table below. Double the dose if the water is cloudy, colored or very cold.',
          'Stir and let it stand for 30 minutes.',
          'The water should smell slightly of chlorine. If it does not, repeat the dose and wait another 15 minutes.',
        ],
      },
      {
        kind: 'table',
        caption: 'Bleach drops per volume of water (EPA)',
        headers: ['Volume of water', '6% bleach', '8.25% bleach'],
        rows: [
          ['1 quart or 1 liter', '2 drops', '2 drops'],
          ['1 gallon', '8 drops', '6 drops'],
        ],
        note: 'Double these amounts if the water is cloudy, colored or very cold.',
      },
      {
        kind: 'warning',
        title: 'Bleach warnings',
        items: [
          'Never use scented or color-safe bleach, or bleach with added cleaners.',
          'Boiling and bleach do not remove heavy metals, salts or most other chemicals.',
        ],
      },
    ],
    checklist: [
      {
        id: 'water-3day',
        label: 'Stored 1 gallon of water per person per day for at least 3 days',
      },
      {
        id: 'water-2wk',
        label: 'Built up to a 2-week supply at home',
        detail: '1 gallon per person per day, times 14.',
      },
      {
        id: 'water-extra',
        label: 'Added extra for children, nursing mothers, sick family members, hot weather and pets',
      },
      {
        id: 'water-bottled',
        label: 'Kept bottled water sealed in its original containers in a cool, dark place',
      },
      {
        id: 'water-rotate',
        label: 'Self-filled water is in clean, sanitized food-grade containers and gets replaced every 6 months',
        detail: 'Write the fill date on each container.',
      },
      {
        id: 'water-bleach',
        label: 'Have regular unscented liquid chlorine bleach (6% or 8.25%), less than a year old, and a clean dropper',
      },
      {
        id: 'water-strain',
        label: 'Have clean cloths or coffee filters for straining cloudy water',
      },
      {
        id: 'water-directions',
        label: 'Printed the boiling and bleach directions and kept them with the water',
      },
    ],
  },

  {
    id: 'food',
    number: 3,
    title: 'Food',
    codename: 'OPERATION PANTRY',
    intro:
      'When the trucks stop, the shelves are empty in a day. They know this. Now you do too.',
    marginNote: 'manual can opener. MANUAL. the electric ones report back.',
    briefing: [
      {
        kind: 'p',
        text: 'Keep at least a several-day supply of non-perishable food. The Red Cross recommends 3 days for evacuation and 2 weeks for home.',
      },
      {
        kind: 'p',
        text: 'Choose foods your household actually eats that need no refrigeration and little or no cooking or water. Avoid foods that make you thirsty.',
      },
      {
        kind: 'list',
        heading: 'Good options',
        items: [
          'Ready-to-eat canned meats, fruits and vegetables',
          'Protein or fruit bars',
          'Dry cereal or granola',
          'Peanut butter',
          'Dried fruit',
          'Canned juices',
          'Non-perishable pasteurized milk',
          'High-energy foods',
          'Food for infants',
          'Comfort foods',
        ],
      },
      {
        kind: 'p',
        text: 'Pack a manual can opener. Remember special diets, infants and pets.',
      },
      {
        kind: 'list',
        heading: 'Storage',
        items: [
          'Store canned food in a cool, dry place.',
          'Store boxed food in tightly closed containers.',
          'Replace expired items, and re-think your needs every year.',
        ],
      },
      {
        kind: 'warning',
        title: 'Food safety in an outage',
        items: [
          'Keep refrigerator and freezer doors closed.',
          'A refrigerator keeps food safe for up to 4 hours without power if the door stays closed.',
          'A full freezer holds its temperature for about 48 hours (about 24 hours if half full).',
          'Use coolers with ice if needed, and check temperatures with a thermometer.',
          'Discard refrigerated perishable food (meat, poultry, fish, eggs, leftovers) after 4 hours without power.',
          'Discard perishable food that has been above 40°F for more than 2 hours, or that has an unusual odor, color or texture.',
          'Never taste food to decide if it is safe. When in doubt, throw it out.',
        ],
      },
    ],
    checklist: [
      {
        id: 'food-3day',
        label: 'Stocked at least 3 days of non-perishable food for everyone',
      },
      {
        id: 'food-2wk',
        label: 'Built up to a 2-week food supply at home',
      },
      {
        id: 'food-nocook',
        label: 'Picked foods we actually eat that need no refrigeration and little or no cooking or water',
      },
      {
        id: 'food-opener',
        label: 'Packed a manual can opener',
      },
      {
        id: 'food-special',
        label: 'Covered special diets, infants and pets',
      },
      {
        id: 'food-storage',
        label: 'Canned food stored cool and dry, boxed food in tightly closed containers',
      },
      {
        id: 'food-rotate',
        label: 'Set a yearly reminder to replace expired items and re-think our needs',
      },
      {
        id: 'food-thermometer',
        label: 'Have a thermometer for the fridge and freezer, and a cooler',
      },
      {
        id: 'food-mess',
        label: 'Have mess kits, paper cups, plates, paper towels and plastic utensils',
      },
    ],
  },

  {
    id: 'power-and-light',
    number: 4,
    title: 'Power and light',
    codename: 'PROJECT LAMPLIGHTER',
    intro:
      'Darkness is the first weapon. Every household that can still see is a household that can still think.',
    marginNote: 'generator INSIDE = they win without lifting a finger.',
    briefing: [
      {
        kind: 'p',
        text: 'Have a flashlight for every household member. Use flashlights, not candles, because candles are a fire risk. A headlamp keeps your hands free.',
      },
      {
        kind: 'p',
        text: 'Plan for batteries and other power sources, such as a portable charger or power bank for your phone. A small solar charger is one way to top up phones and power banks without the grid. Keep a fire extinguisher, and matches in a waterproof container.',
      },
      {
        kind: 'list',
        heading: 'Generator basics',
        items: [
          'Use a generator outdoors only, at least 20 feet from windows, doors and attached garages.',
          'Keep it dry and protected from rain.',
          'Connect appliances to it with heavy-duty extension cords.',
          'Let it cool before refueling.',
          'Never plug a generator into a wall outlet. This "backfeeding" can endanger utility workers and your neighbors.',
          'If you want a generator connected to your home wiring, a transfer switch must be installed by a licensed electrician.',
        ],
      },
      {
        kind: 'warning',
        title: 'Carbon monoxide kills',
        items: [
          'Carbon monoxide (CO) is colorless and odorless.',
          'Never use a generator, camp stove or charcoal grill indoors or in a garage.',
          'Never use a gas stove or oven to heat your home.',
          'Install CO detectors with battery backup in central locations on every level of your home.',
          'Symptoms: headache, dizziness, weakness, upset stomach, vomiting, chest pain, confusion.',
          'If the CO alarm sounds or anyone has symptoms, get to fresh air immediately and call 911.',
        ],
      },
    ],
    checklist: [
      {
        id: 'power-flashlights',
        label: 'A flashlight for every household member',
      },
      {
        id: 'power-headlamp',
        label: 'Headlamps for hands-free light',
      },
      {
        id: 'power-batteries',
        label: 'Extra batteries in the sizes our gear uses',
      },
      {
        id: 'power-banks',
        label: 'Charged power banks or portable chargers for phones',
        detail: 'Recharge them on a schedule so they are full when needed.',
      },
      {
        id: 'power-recharge',
        label: 'A way to recharge without the grid, such as a solar charger or a car phone charger',
      },
      {
        id: 'power-co',
        label: 'CO detectors with battery backup on every level of the home',
      },
      {
        id: 'power-generator',
        label: 'If we have a generator: it runs outdoors only, 20+ feet from the house, on heavy-duty cords, never plugged into a wall outlet',
      },
      {
        id: 'power-fire',
        label: 'Fire extinguisher and matches in a waterproof container',
      },
    ],
  },

  {
    id: 'comms',
    number: 5,
    title: 'Comms',
    codename: 'OPERATION DEAD DROP',
    intro:
      'When the towers go quiet, the only network they cannot shut down is the one written on paper in your wallet.',
    marginNote: 'TEXT. do not call. calls are easier to listen to. (also they jam the network.)',
    briefing: [
      {
        kind: 'p',
        text: 'Keep a battery-powered or hand-crank radio, and a NOAA Weather Radio with tone alert, so you can get emergency alerts and instructions without power or internet.',
      },
      {
        kind: 'list',
        heading: 'Make a plan',
        items: [
          'Decide how you will get emergency alerts.',
          'Decide on your shelter plan and your evacuation route.',
          'Make a family communication plan.',
          'Pick meeting places that are familiar and easy to find: one right outside your home and one outside your neighborhood.',
          'Pick an out-of-town contact everyone can check in with.',
          'Keep a paper copy of your contacts. A dead phone has no address book.',
        ],
      },
      {
        kind: 'list',
        heading: 'During a disaster',
        items: [
          'Text rather than call. Phone networks get congested, and text is best.',
          'Save battery: lower the screen brightness, use low-power or airplane mode, and close apps you are not using.',
          'Keep paper local maps. Downloading offline maps to your phone in advance also helps.',
          'Keep a whistle to signal for help.',
        ],
      },
    ],
    checklist: [
      {
        id: 'comms-radio',
        label: 'Have a battery-powered or hand-crank radio and a NOAA Weather Radio with tone alert',
      },
      {
        id: 'comms-alerts',
        label: 'Decided how we will get emergency alerts',
      },
      {
        id: 'comms-plan',
        label: 'Wrote down our shelter plan, evacuation route and family communication plan',
      },
      {
        id: 'comms-meet',
        label: 'Picked two meeting places: right outside the home and outside the neighborhood',
      },
      {
        id: 'comms-contact',
        label: 'Picked an out-of-town contact everyone knows to check in with',
      },
      {
        id: 'comms-paper',
        label: 'Every family member carries a written contact list',
      },
      {
        id: 'comms-maps',
        label: 'Have paper local maps and downloaded offline maps',
      },
      {
        id: 'comms-text',
        label: 'The household agreed: text first, call only if needed',
      },
      {
        id: 'comms-whistle',
        label: 'Packed a whistle to signal for help',
      },
    ],
  },

  {
    id: 'cash',
    number: 6,
    title: 'Cash',
    codename: 'PROJECT GREENBACK',
    intro:
      'Your money is a number on a server. Servers need electricity. Paper does not.',
    marginNote: 'small bills. nobody makes change at the end of the world.',
    briefing: [
      {
        kind: 'p',
        text: 'ATMs, card readers and payment apps need power and working networks. In a long outage they may not work. Ready.gov lists cash among its emergency kit supplies.',
      },
      {
        kind: 'p',
        text: 'Keep cash in small bills, because stores may not be able to make change. There is no official dollar amount. Keep enough for several days of essentials.',
      },
      {
        kind: 'p',
        text: 'Keep copies of important documents, such as insurance policies, identification and bank account records, saved electronically or in a waterproof, portable container.',
      },
    ],
    checklist: [
      {
        id: 'cash-small',
        label: 'Set aside cash in small bills',
      },
      {
        id: 'cash-amount',
        label: 'Have enough cash for several days of essentials',
      },
      {
        id: 'cash-secure',
        label: 'Stored the cash in a secure spot that trusted household members know about',
      },
      {
        id: 'cash-car',
        label: 'Kept a small separate stash with the car kit',
      },
      {
        id: 'cash-docs',
        label: 'Copies of insurance policies, ID and bank records saved electronically or in a waterproof, portable container',
      },
    ],
  },

  {
    id: 'medical',
    number: 7,
    title: 'Medical',
    codename: 'OPERATION FIELD DRESSING',
    intro:
      'The pharmacy runs on the same grid as everything else. Funny how nobody mentions that.',
    marginNote: 'write the list by hand. the cloud forgets on purpose.',
    briefing: [
      {
        kind: 'p',
        text: 'Keep a first aid kit and a supply of prescription medications. The Red Cross lists a 7-day supply of medications in its kit. Keep a written list of medications, dosages, allergies and doctors.',
      },
      {
        kind: 'p',
        text: 'Talk to your medical provider about a plan for refrigerated medicines and electrically powered medical devices. Ask how long your medications can be stored at higher temperatures.',
      },
      {
        kind: 'warning',
        title: 'Refrigerated medication',
        text: 'If the power is out for a day or more, discard refrigerated medication unless the label says otherwise, and contact your doctor or pharmacist for a new supply. Get specific guidance for any medication that is critical for life.',
      },
      {
        kind: 'list',
        heading: 'Also pack',
        items: [
          'Non-prescription medications such as pain relievers, anti-diarrhea medication, antacids or laxatives',
          'Prescription eyeglasses and contact lens solution',
          'Soap, hand sanitizer and disinfecting wipes',
          'Moist towelettes, garbage bags and plastic ties for personal sanitation',
          'Feminine supplies and personal hygiene items',
          'Dust masks',
          'Infant formula, bottles, diapers and wipes, if you need them',
        ],
      },
    ],
    checklist: [
      {
        id: 'med-firstaid',
        label: 'Have a first aid kit',
      },
      {
        id: 'med-7day',
        label: 'Have at least a 7-day supply of prescription medications',
      },
      {
        id: 'med-list',
        label: 'Wrote down medications, dosages, allergies and doctors for each person',
      },
      {
        id: 'med-plan',
        label: 'Talked to our medical provider about refrigerated medicines and powered medical devices',
      },
      {
        id: 'med-otc',
        label: 'Packed pain relievers, anti-diarrhea medication, antacids and laxatives',
      },
      {
        id: 'med-eyes',
        label: 'Packed spare prescription glasses and contact lens solution',
      },
      {
        id: 'med-hygiene',
        label: 'Packed soap, hand sanitizer, disinfecting wipes, feminine supplies and hygiene items',
      },
      {
        id: 'med-sanitation',
        label: 'Packed moist towelettes, garbage bags and plastic ties for sanitation',
      },
      {
        id: 'med-masks',
        label: 'Packed dust masks',
      },
    ],
  },

  {
    id: 'heat-cooling-shelter',
    number: 8,
    title: 'Heat, cooling and shelter',
    codename: 'PROJECT THERMOSTAT',
    intro:
      'They control the weather. Probably. They definitely control the thermostat. Learn to live without it.',
    marginNote: 'a fan is NOT air conditioning. they want you to think it is.',
    briefing: [
      {
        kind: 'p',
        text: 'Without power, there may be no air conditioning and no electric heat. If the heat or cold is extreme, go to a community location that has power, or contact local officials or your local health department about cooling and warming options. Libraries and shopping malls are examples of cooling centers.',
      },
      {
        kind: 'list',
        heading: 'Staying cool',
        items: [
          'Take cool showers or baths.',
          'Wear loose, lightweight, light-colored clothing.',
          'Drink plenty of fluids.',
          'Avoid strenuous activity in the midday heat.',
          'Do not rely on a fan as your main way to cool down. Fans do not lower body temperature or prevent heat-related illness.',
          'Use fans only if the indoor temperature is below 90°F. Above 90°F, a fan can raise body temperature.',
          'Never leave people or pets in a parked car.',
        ],
      },
      {
        kind: 'warning',
        title: 'Heat stroke: call 911',
        items: [
          'Signs: extremely high body temperature (above 103°F); red, hot and dry skin with no sweat; rapid, strong pulse; dizziness, confusion or unconsciousness.',
          'Call 911 or get the person to a hospital immediately.',
          'Until help arrives, cool them down: move them to a cool, shaded place, remove outer clothing, and put cold wet cloths or ice packs on the head, neck, armpits and groin, or soak their clothing with cool water.',
        ],
      },
      {
        kind: 'warning',
        title: 'Heat exhaustion',
        items: [
          'Signs: heavy sweating, paleness, muscle cramps, tiredness, weakness, fast or weak pulse, dizziness, headache, fainting, nausea, vomiting.',
          'Go to a cooler location, remove excess clothing, and take sips of sports drinks or water.',
          'Call your healthcare provider if symptoms get worse or last more than an hour.',
        ],
      },
      {
        kind: 'list',
        heading: 'Staying warm',
        items: [
          'Wear layers.',
          'Gather in one room and close off rooms you are not using.',
          'Use blankets or sleeping bags, and block drafts.',
          'Never heat your home with a gas stovetop or oven. Use generators and grills outdoors only.',
        ],
      },
      {
        kind: 'warning',
        title: 'Hypothermia: an emergency',
        items: [
          'A body temperature below 95°F is an emergency.',
          'Signs: shivering, exhaustion, confusion, fumbling hands, memory loss, slurred speech or drowsiness.',
          'Go to a warm room. Warm the center of the body first: chest, neck, head and groin. Keep the person dry and wrapped in warm blankets, including the head and neck.',
        ],
      },
      {
        kind: 'warning',
        title: 'Frostbite',
        items: [
          'Signs: numbness; white or grayish-yellow skin; firm or waxy skin.',
          'Go to a warm room. Soak in warm water, or use body heat to warm the area.',
          'Do not massage the area or use a heating pad.',
        ],
      },
    ],
    checklist: [
      {
        id: 'shelter-bedding',
        label: 'A sleeping bag or warm blanket for each person',
      },
      {
        id: 'shelter-clothes',
        label: 'A complete change of clothing for our climate and sturdy shoes for each person',
      },
      {
        id: 'shelter-room',
        label: 'Picked one room to gather in when it is cold, and know how we will block drafts',
      },
      {
        id: 'shelter-sheeting',
        label: 'Have plastic sheeting, scissors and duct tape to shelter in place',
      },
      {
        id: 'shelter-tools',
        label: 'Have a wrench or pliers to turn off utilities',
      },
      {
        id: 'shelter-signs',
        label: 'Everyone knows the signs of heat stroke, heat exhaustion, hypothermia and frostbite',
      },
      {
        id: 'shelter-neighbors',
        label: 'Have a plan to check on older relatives and neighbors',
      },
    ],
  },

  {
    id: 'fuel-and-transport',
    number: 9,
    title: 'Fuel and transport',
    codename: 'OPERATION HALF TANK',
    intro:
      'Gas pumps need electricity. Ask yourself who benefits when nobody can leave town.',
    marginNote: 'half a tank IS empty. say it with me.',
    briefing: [
      {
        kind: 'p',
        text: 'Gas station pumps need electricity. Ready.gov advises keeping your gas tank full in case you need to evacuate or the power goes out. The everyday habit that gets you there: treat half a tank as empty, and fill up.',
      },
      {
        kind: 'list',
        heading: 'Car kit',
        items: [
          'Jumper cables',
          'Flares or a reflective triangle',
          'Ice scraper',
          'Car cell phone charger',
          'Blanket',
          'Map',
          'Cat litter or sand for traction',
        ],
      },
      {
        kind: 'warning',
        title: 'On the road',
        items: [
          'Stay away from downed power lines.',
          'If a power line falls on your car, stay inside until a trained person removes it.',
          'Treat a dark traffic signal as an all-way stop.',
          'Never run a vehicle inside a closed garage, because of carbon monoxide.',
          'Store spare fuel only in approved containers, away from living areas and ignition sources.',
        ],
      },
    ],
    checklist: [
      {
        id: 'fuel-half',
        label: 'Treat half a tank as empty and refill',
      },
      {
        id: 'fuel-full',
        label: 'Fill the tank when trouble is forecast',
      },
      {
        id: 'fuel-kit',
        label: 'Packed a car kit: jumper cables, flares or triangle, ice scraper, phone charger, blanket, map, cat litter or sand',
      },
      {
        id: 'fuel-cans',
        label: 'Any spare fuel is in approved containers, away from living areas and ignition sources',
      },
      {
        id: 'fuel-route',
        label: 'Every driver knows our evacuation route',
      },
      {
        id: 'fuel-rules',
        label: 'Every driver knows: dark signal means all-way stop, and stay in the car if a power line falls on it',
      },
    ],
  },

  {
    id: 'digital-prep',
    number: 10,
    title: 'Digital prep',
    codename: 'PROJECT COLD STORAGE',
    intro:
      'If it only exists in the cloud, it exists at their pleasure. Back it up, print it out, and keep your keys where no server can reach them.',
    marginNote: 'NO legit support agent will EVER ask for your seed phrase. not even us. ESPECIALLY not us.',
    briefing: [
      {
        kind: 'list',
        heading: 'Backups and documents',
        items: [
          'Follow the 3-2-1 rule: 3 copies of your important data, on 2 different types of media, with 1 copy off-site.',
          'Keep at least one backup offline (disconnected), so ransomware cannot reach it.',
          'Test a restore, so you know the backup actually works.',
          'Print copies of key documents (IDs, insurance, bank records, medical information, emergency contacts) and keep them in a waterproof, portable container.',
        ],
      },
      {
        kind: 'list',
        heading: 'Accounts',
        items: [
          'Use a password manager with a unique password for every account. Print its recovery kit or emergency sheet, store it safely, and make sure you can unlock the manager offline.',
          'Turn on multi-factor authentication (MFA) everywhere you can.',
          'Hardware security keys (FIDO2) are phishing-resistant. Register two: one to use, one backup stored separately. Print your backup codes.',
          'Authenticator apps work without cell service. SMS codes do not.',
          'Keep your devices and apps updated.',
        ],
      },
      {
        kind: 'list',
        heading: 'Crypto self-custody',
        items: [
          'A hardware wallet keeps your private keys offline (cold storage).',
          'Write your seed (recovery) phrase on paper or stamp it in metal. Never photograph, screenshot, type, email or store it in the cloud.',
          'Keep it in two separate secure places, for example a fire-resistant safe and a safe deposit box.',
          'Never share it with anyone. No legitimate support agent will ever ask for it.',
          'Test your recovery before you trust the wallet with real funds.',
        ],
      },
      {
        kind: 'warning',
        title: 'During an outage',
        items: [
          'Your coins are still on-chain. You do not need to do anything.',
          'Urgent "emergency" messages asking you to move funds or sign something are scams.',
          'Phishing spikes around major incidents. Slow down before you click.',
        ],
      },
    ],
    checklist: [
      {
        id: 'dig-backup',
        label: 'Set up 3-2-1 backups with at least one copy kept offline',
      },
      {
        id: 'dig-restore',
        label: 'Tested restoring from a backup',
      },
      {
        id: 'dig-print',
        label: 'Printed key documents and stored them in a waterproof, portable container',
        detail: 'IDs, insurance, bank records, medical info, emergency contacts.',
      },
      {
        id: 'dig-pwmgr',
        label: 'Use a password manager with unique passwords, and printed its recovery kit',
        detail: 'Confirm you can unlock it offline.',
      },
      {
        id: 'dig-mfa',
        label: 'Turned on MFA everywhere, using an authenticator app or security key instead of SMS where possible',
      },
      {
        id: 'dig-keys',
        label: 'Registered two hardware security keys (one stored separately) and printed backup codes',
      },
      {
        id: 'dig-updates',
        label: 'Devices and apps are up to date',
      },
      {
        id: 'dig-seed',
        label: 'Seed phrase written on paper or metal, never digital, stored in two separate secure places',
      },
      {
        id: 'dig-wallet',
        label: 'Crypto in a hardware wallet, and tested recovery before trusting it with real funds',
      },
    ],
  },
];

export interface SourceLink {
  label: string;
  url: string;
}

export interface SourceGroup {
  org: string;
  links: SourceLink[];
}

export const SURVIVAL_SOURCES: SourceGroup[] = [
  {
    org: 'Ready.gov (FEMA)',
    links: [
      { label: 'Build a Kit', url: 'https://www.ready.gov/kit' },
      { label: 'Power Outages', url: 'https://www.ready.gov/power-outages' },
      { label: 'Water', url: 'https://www.ready.gov/water' },
      { label: 'Food', url: 'https://www.ready.gov/food' },
      { label: 'Make a Plan', url: 'https://www.ready.gov/plan' },
      { label: 'Car Safety', url: 'https://www.ready.gov/car' },
      { label: 'Financial Preparedness', url: 'https://www.ready.gov/financial-preparedness' },
      { label: 'Cybersecurity', url: 'https://www.ready.gov/cybersecurity' },
      { label: 'Extreme Heat', url: 'https://www.ready.gov/heat' },
      { label: 'Winter Weather', url: 'https://www.ready.gov/winter-weather' },
    ],
  },
  {
    org: 'American Red Cross',
    links: [
      {
        label: 'Power Outage Safety',
        url: 'https://www.redcross.org/get-help/how-to-prepare-for-emergencies/types-of-emergencies/power-outage.html',
      },
      {
        label: 'Survival Kit Supplies',
        url: 'https://www.redcross.org/get-help/how-to-prepare-for-emergencies/survival-kit-supplies.html',
      },
    ],
  },
  {
    org: 'U.S. Environmental Protection Agency',
    links: [
      {
        label: 'Emergency Disinfection of Drinking Water',
        url: 'https://www.epa.gov/ground-water-and-drinking-water/emergency-disinfection-drinking-water',
      },
    ],
  },
  {
    org: 'Centers for Disease Control and Prevention',
    links: [
      { label: 'CDC: About Carbon Monoxide Poisoning', url: 'https://www.cdc.gov/carbon-monoxide/about/index.html' },
      { label: 'CDC: About Heat and Your Health', url: 'https://www.cdc.gov/heat-health/about/index.html' },
    ],
  },
  {
    org: 'FoodSafety.gov (USDA / HHS)',
    links: [
      {
        label: 'Food Safety During a Power Outage',
        url: 'https://www.foodsafety.gov/food-safety-charts/food-safety-during-power-outage',
      },
    ],
  },
  {
    org: 'Cybersecurity and Infrastructure Security Agency (CISA)',
    links: [
      { label: 'Secure Our World', url: 'https://www.cisa.gov/secure-our-world' },
      { label: 'Multifactor Authentication', url: 'https://www.cisa.gov/MFA' },
    ],
  },
];

/** Rank labels for the preparedness score, lowest threshold first. */
export const SCORE_RANKS: { min: number; label: string; note: string }[] = [
  { min: 0, label: 'SITTING DUCK', note: 'They are counting on you staying like this.' },
  { min: 1, label: 'SHEEPLE', note: 'One eye open. Keep going.' },
  { min: 20, label: 'MILDLY SUSPICIOUS', note: 'You have started asking questions.' },
  { min: 40, label: 'WAKING UP', note: 'The dots are connecting.' },
  { min: 60, label: 'TRUTH SEEKER', note: 'Your pantry is a statement.' },
  { min: 80, label: 'OFF-GRID OPERATIVE', note: 'They have opened a file on you.' },
  { min: 100, label: 'FULLY HATTED', note: 'Nothing gets through the foil.' },
];

export function rankFor(percent: number): (typeof SCORE_RANKS)[number] {
  let rank = SCORE_RANKS[0];
  for (const r of SCORE_RANKS) if (percent >= r.min) rank = r;
  return rank;
}

export const ALL_CHECKLIST_IDS: string[] = SURVIVAL_SECTIONS.flatMap((s) => s.checklist.map((i) => i.id));
