import type { Category } from '../shared/types';

/**
 * Keyword categorizer. Each category has a list of patterns; an item gets
 * every category with at least one hit. Patterns are deliberately narrow to
 * avoid the classic false positives (CI/CD "pipeline", PowerShell "power",
 * "cryptographic", a botnet takedown that "disrupts" something, a
 * "denial-of-service" vulnerability, and so on).
 *
 * Regexes without the `i` flag are intentionally case-sensitive (acronyms and
 * proper names).
 */
type Rules = Partial<Record<Exclude<Category, 'Other'>, RegExp[]>>;

const RULES: Rules = {
  Ransomware: [
    /\bransom(ware)?s?\b/i,
    /\b(double|triple|data)[- ]extortion\b/i,
    /\bextort(s|ed|ing|ion|ionists?)?\b/i,
    /\b(LockBit|BlackCat|ALPHV|Cl0p|CL0P|Qilin|Akira|Black ?Basta|Rhysida|BlackSuit|RansomHub|Hunters International|8Base|DragonForce|Interlock|SafePay|Cicada3301|BianLian|Babuk|Ryuk|REvil|Conti|Phobos|Mallox|LockerGoga|NotPetya|WannaCry|Medusa ransomware|Play ransomware|Royal ransomware)\b/,
  ],

  'Data Breach': [
    /\bbreach(es|ed)?\b/i,
    /(?<!memory )\bleak(s|ed|age|ing)?\b/i,
    /\b(data|information|records|credentials|files|details|emails|passwords) (were |was |has been |have been )?(stolen|exposed|accessed|exfiltrated|compromised|leaked|dumped)\b/i,
    /\b(steal|steals|stealing|stole|stolen) (\w+ ){0,3}(data|information|records|credentials|files|details|passwords|keys|tokens)\b/i,
    /\bexpos(ed|es|ing)\b.{0,40}\b(data|records|information|database|PII|customers|users|patients)\b/i,
    /\b(customer|personal|patient|student|employee|client|member|voter|health|medical|user) (data|information|records|details)\b/i,
    /\bexfiltrat(e|ed|es|ing|ion)\b/i,
    /\bdata (theft|dump|exposure|stolen|leak)\b/i,
    /\b(doxx?(ed|ing)?|hack-and-leak)\b/i,
    /\bShinyHunters\b/,
  ],

  'Infrastructure/Grid': [
    /\b(power|electric(al|ity)?|energy) (grid|grids|utility|utilities|plant|plants|station|stations|substation|substations|company|companies|provider|providers|supplier|supply|sector|infrastructure|firm|operator|operators|network|outage|outages)\b/i,
    /\b(grid|grids|blackouts?|substations?)\b/i,
    /\b(water|wastewater) (utility|utilities|system|systems|treatment|supply|plant|plants|facility|facilities|sector|district|authority)\b/i,
    /\bnuclear (plant|plants|power|facility|facilities|reactor|reactors)\b/i,
    /\b(oil|gas|fuel|petroleum|natural gas|LNG) (pipelines?|company|companies|producer|terminal|refinery|refineries|sector|industry|infrastructure)\b/i,
    /\boil and gas\b/i,
    /\bpipeline (operator|operators|company|companies|firm)\b/i,
    /\bColonial Pipeline\b/i,
    /\b(ICS|SCADA|OT|PLCs?|HMIs?|RTUs?|DCS)\b/,
    /\bindustrial control( systems?)?\b/i,
    /\boperational technology\b/i,
    /\bcritical infrastructure\b/i,
    /\butilities\b(?! (function|functions|software|tool|tools|app|apps|program|programs|class|classes|library|libraries))/i,
    /\b((electric|water|gas|public|municipal|power) utility|utility (company|companies|provider|providers|firm|sector|customers|operator|operators))\b/i,
    /\b(telecoms?|telecommunications?|telcos?|mobile (operators?|networks?|carriers?)|cellular networks?|wireless carriers?|internet service providers?)\b/i,
    /\bhospitals?\b/i,
    /\b(health ?care|medical) (system|systems|provider|providers|network|networks|facility|facilities|center|centers)\b/i,
    /\b(airports?|airlines?|air traffic|aviation|FAA|ground stop)\b/i,
    /\b(railways|railroads?|(rail|railway) (network|networks|operator|operators|system|systems|services?|company|station|stations)|train (operator|operators|services?|network|stations?)|metro system|transit (agency|system|authority))\b/i,
    /\b(ports?|shipping|maritime) (operator|operators|authority|terminal|terminals|company|giant)\b/i,
    /\b(911|emergency services|dams?)\b/i,
  ],

  Outage: [
    /\boutages?\b/i,
    /\bdowntime\b/i,
    /\b(knock|knocks|knocked|knocking|take|takes|taken|took|went|go|goes|going|forced|forces|remain|remains|remained|is|are|was|were|brought|bring|brings|been) (\w+ ){0,2}offline\b/i,
    /\bdisrupted by\b/i,
    /\b(was|were|been|being|are|is|remain|remains|remained) (\w+ )?disrupted\b/i,
    /\b(?<!(botnet|malware|takedown|operation|enforcement|law enforcement|police|criminal|gang|group|infrastructure) )disruptions?\b(?! (of|to) (a |the )?(botnet|malware|ransomware|gang|group|operation|infrastructure|network of))/i,
    /\bDDoS(?!-for-hire)\b/i,
    /\bdistributed denial[- ]of[- ]service\b/i,
    /(?<!(cause|causing|causes|trigger|triggering|triggers|lead to|leading to|leads to|result in|resulting in|results in) (a |an )?)\bdenial[- ]of[- ]service (attack|attacks)\b/i,
    /\b(service|services|systems?|websites?|networks?|platforms?|email)( (is|are|was|were|remain|remains|remained|went|go|goes|still|been|have|has|largely|partially|completely))* (down|unavailable|inaccessible)\b/i,
    /\brestor(e|es|ed|ing) (\w+ ){0,4}(services|systems|operations|access|email|service)\b/i,
    /\b(halt|halts|halted|halting|suspend|suspends|suspended|suspending) (\w+ )?(production|operations|services|flights|trading|shipments|deliveries)\b/i,
    /\b(production|operations|services|flights|systems) (were |was |have been |has been )?(halted|suspended|shut down|grounded)\b/i,
    /\bground stop\b/i,
    /\bflights? (grounded|delayed|cancell?ed)\b/i,
    /\bblackouts?\b/i,
  ],

  'Vulnerability/Zero-Day': [
    /\bzero[- ]?days?\b/i,
    /\b0-?days?\b/i,
    /\bCVE-\d{4}-\d{4,}\b/i,
    /\bvulnerabilit(y|ies)\b/i,
    /\bvulns?\b/i,
    /\bvulnerable\b/i,
    /\bexploit(s|ed|ing|ation|able)?\b/i,
    /\bpatch(es|ed|ing)?\b/i,
    /\bunpatched\b/i,
    /\bRCE\b/,
    /\bremote code execution\b/i,
    /\bflaws?\b/i,
    /\bbugs?\b/i,
    /\bsecurity (update|updates|fix|fixes|advisory|advisories|hole|holes)\b/i,
    /\b(authentication|auth) bypass\b/i,
    /\bprivilege escalation\b/i,
    /\b(SQL injection|command injection|code injection|XSS|cross-site scripting|buffer overflow|out-of-bounds|use-after-free|memory corruption|path traversal|deserialization)\b/i,
    /\bKnown Exploited\b/i,
    /\bKEV\b/,
  ],

  'Nation-State': [
    /\bAPT ?\d+\b/,
    /\bAPTs?\b/,
    /\bnation[- ]states?\b/i,
    /\bstate[- ](sponsored|backed|linked|aligned|affiliated)\b/i,
    /\b(cyber[- ]?)?espionage\b/i,
    /\bcyber ?spies\b/i,
    /\b(Lazarus|Kimsuky|Andariel|BlueNoroff|Sandworm|Turla|Gamaredon|MuddyWater|OilRig|Equation Group|Fancy Bear|Cozy Bear|Venomous Bear|Ember Bear|Charming Kitten|Mustang Panda|Wicked Panda|Volt Typhoon|Salt Typhoon|Flax Typhoon|Silk Typhoon|Hafnium|HAFNIUM|TraderTraitor|Blind Eagle|UNC\d{3,5})\b/,
    /\b[A-Z][a-z]+ (Typhoon|Blizzard|Sandstorm|Sleet|Chollima)\b/,
    /\b(North Korean?|DPRK|Chinese|China|Russian?|Iranian?|Belarusian|Pakistani|Vietnamese)(-(linked|backed|nexus|aligned|sponsored|based))?,? (state |government |military |intelligence |nation-state )?(hackers?|hacking (groups?|crews?|units?|operations?|campaigns?)|APTs?|threat (actors?|groups?)|cyber ?(actors?|groups?|operatives?|spies|army|units?|attacks?|espionage)|spies|spy agency|intelligence (agency|service|officers?)|IT workers|operatives)\b/i,
    /\b(China|Chinese|Russia|Russian|Iran|Iranian|North Korea|DPRK|Beijing|Kremlin|Pyongyang|Tehran)-(linked|backed|nexus|aligned|sponsored)\b/i,
    /\b(GRU|SVR|FSB|IRGC)\b/,
    /\bnation[- ]state\b/i,
  ],

  'Crypto Hack': [
    /\bcrypto(currency|currencies)?s?\b/i,
    /\b(bitcoin|ethereum|solana|monero|stablecoins?|tether|altcoins?|memecoins?|blockchain|smart contracts?)\b/i,
    /\b(BTC|ETH|USDT|USDC|XRP)\b/,
    /\bwallets?\b/i,
    /\bdrain(ed|er|ers|ing|s)?\b/i,
    /\b(DeFi|web3|NFTs?)\b/i,
    /\b(seed|recovery|mnemonic) phrases?\b/i,
    /\b(crypto )?exchange (hack|hacked|breach|heist|exploit|exploited)\b/i,
    /\b(Binance|Coinbase|Kraken|Bybit|OKX|KuCoin|Trezor|Ledger|MetaMask|Uniswap|Tornado Cash|Hyperliquid)\b/,
    /\b(rug pull|pig[- ]butchering|crypto ?(scam|theft|heist|stealer|drainer)s?)\b/i,
  ],
};

export interface CategorizeOptions {
  /** Categories implied by the source (for example CISA ICS advisories). Always included. */
  hints?: readonly Category[];
}

/**
 * When several categories match the headline, the more specific story type
 * wins: a ransomware attack on a utility is a ransomware story first, and
 * "flaw"/"patch"/"breach" style words are the most generic.
 */
const PRIORITY: Category[] = [
  'Ransomware',
  'Crypto Hack',
  'Nation-State',
  'Outage',
  'Data Breach',
  'Infrastructure/Grid',
  'Vulnerability/Zero-Day',
  'Other',
];

/**
 * Returns the item's categories, most relevant first (the ticker shows the
 * first one). Ranking: any title hit, then source hints (in the order given), then (for
 * snippet-only matches) the number of snippet hits, then PRIORITY.
 * 'Other' only when nothing matched.
 */
export function categorize(title: string, snippet = '', opts: CategorizeOptions = {}): Category[] {
  const scores = new Map<Category, { title: number; hint: number; snippet: number }>();
  const bump = (c: Category, key: 'title' | 'hint' | 'snippet') => {
    const s = scores.get(c) ?? { title: 0, hint: 0, snippet: 0 };
    s[key]++;
    scores.set(c, s);
  };

  for (const [cat, patterns] of Object.entries(RULES) as [Category, RegExp[]][]) {
    for (const re of patterns) {
      if (re.test(title)) bump(cat, 'title');
      else if (snippet && re.test(snippet)) bump(cat, 'snippet');
    }
  }
  for (const h of opts.hints ?? []) if (h !== 'Other') bump(h, 'hint');

  if (scores.size === 0) return ['Other'];
  const hints = opts.hints ?? [];
  // Hints keep the order the source gave them (earlier = more relevant).
  const rank = (c: Category, s: { title: number; hint: number; snippet: number }) => [
    s.title > 0 ? 1 : 0,
    s.hint > 0 ? hints.length - hints.indexOf(c) : 0,
    s.title > 0 ? 0 : s.snippet,
  ];
  return [...scores.entries()]
    .sort(([ca, a], [cb, b]) => {
      const ra = rank(ca, a);
      const rb = rank(cb, b);
      for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return rb[i] - ra[i];
      return PRIORITY.indexOf(ca) - PRIORITY.indexOf(cb);
    })
    .map(([c]) => c);
}
