import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Category } from '../shared/types';
import { categorize } from './categorize';

interface Case {
  title: string;
  snippet?: string;
  /** Acceptable primary categories (categories[0]). */
  primary: Category[];
  includes?: Category[];
  excludes?: Category[];
}

const CASES: Case[] = [
  // Real headlines from the feeds on 2026-11-13.
  { title: 'Trezor confirms crypto-stealing implants in three wallets, releases fix', primary: ['Crypto Hack'] },
  { title: 'German military drone operations disrupted by cyberattack', primary: ['Outage'] },
  { title: 'Check Point warns of zero-day flaw exploited for root access', primary: ['Vulnerability/Zero-Day'] },
  {
    title: 'FBI Says North Korean Hackers Stole Over $400 Million in Crypto Using Deepfake Video Calls',
    primary: ['Nation-State', 'Crypto Hack'],
    includes: ['Nation-State', 'Crypto Hack'],
  },
  {
    title: 'City of Osaka warns of data breach impacting 1 million as Japan reels from dozens of cyber incidents',
    primary: ['Data Breach'],
  },
  { title: 'Who Runs the Ransomware Group Qilin?', primary: ['Ransomware'] },
  {
    title: 'Microsoft Struggles to Restore Email and Other Services in a Global Outage',
    snippet:
      'Microsoft is trying different ways to identify the cause of the problem and get its servers back online, using "a measured approach to identify and repair affected infrastructure."',
    primary: ['Outage'],
    excludes: ['Infrastructure/Grid'],
  },
  {
    title: 'Law Enforcement Disrupts Gootloader, CastleRAT, and StealC Infrastructure',
    primary: ['Other'],
    excludes: ['Outage', 'Infrastructure/Grid'],
  },
  {
    title: 'NYC to bar surveillance pricing as momentum for bans grows nationwide',
    snippet: 'The New York City government will be able to fine companies $1,000 for each verified instance of surveillance pricing.',
    primary: ['Other'],
  },
  {
    title: 'FAA Ground Stop Issued Due to ‘Extraordinary Circumstances’',
    snippet: 'Federal officials have yet to say what caused the communications disruption or whether they are investigating a possible cyberattack.',
    primary: ['Outage', 'Infrastructure/Grid'],
    includes: ['Outage', 'Infrastructure/Grid'],
  },
  {
    title: 'University of Texas at Arlington warns personal information stolen during cyberattack',
    primary: ['Data Breach'],
  },
  { title: 'Apify Confirms Customer Data Accessed in Cyberattack', primary: ['Data Breach'] },
  {
    title: 'PostgreSQL Patches 52 Flaws, Including 22-Year-Old Bug Enabling Authenticated RCE',
    primary: ['Vulnerability/Zero-Day'],
  },
  { title: 'Microsoft Fixes Nearly 1,100 Security Vulnerabilities', primary: ['Vulnerability/Zero-Day'] },
  {
    title: 'Trezor Confirms Hidden Implants in CryptoBilis-Sold Wallets That Can Steal Recovery Phrases',
    primary: ['Crypto Hack'],
  },

  // Synthetic but realistic, mostly false-positive traps.
  { title: 'Volt Typhoon hackers lurked in US water utility networks for months', primary: ['Nation-State', 'Infrastructure/Grid'], includes: ['Nation-State', 'Infrastructure/Grid'] },
  { title: 'Ransomware attack on fuel pipeline operator forces shutdown', primary: ['Ransomware'], includes: ['Infrastructure/Grid'] },
  { title: 'Attackers abuse CI/CD pipeline secrets in GitHub Actions supply chain attack', primary: ['Other'], excludes: ['Infrastructure/Grid'] },
  { title: 'New PowerShell backdoor spreads via fake updates', primary: ['Other'], excludes: ['Infrastructure/Grid'] },
  { title: 'NIST finalizes new cryptographic standards for post-quantum era', primary: ['Other'], excludes: ['Crypto Hack'] },
  { title: 'DeFi protocol drained of $12 million in flash loan exploit', primary: ['Crypto Hack'] },
  { title: 'Hackers steal $40M from Solana-based exchange hot wallet', primary: ['Crypto Hack'] },
  { title: 'Massive DDoS attack knocks Finnish government websites offline', primary: ['Outage'] },
  {
    title: 'Cisco fixes flaw in IOS XE',
    snippet: 'Successful exploitation could allow an unauthenticated attacker to cause a denial-of-service attack on an affected device, or a denial-of-service condition.',
    primary: ['Vulnerability/Zero-Day'],
    excludes: ['Outage'],
  },
  { title: 'Chinese state-sponsored hackers breach telecom giants in espionage campaign', primary: ['Nation-State'], includes: ['Infrastructure/Grid', 'Data Breach'] },
  { title: 'APT29 targets diplomats with new malware loader', primary: ['Nation-State'] },
  { title: 'Siemens SCADA software flaw puts ICS at risk', primary: ['Infrastructure/Grid', 'Vulnerability/Zero-Day'], includes: ['Infrastructure/Grid', 'Vulnerability/Zero-Day'] },
  { title: 'Hospital diverts ambulances after cyberattack takes systems offline', primary: ['Infrastructure/Grid', 'Outage'], includes: ['Infrastructure/Grid', 'Outage'] },
  { title: 'LockBit affiliate extradited to the US', primary: ['Ransomware'] },
  { title: 'Hacker leaks 2 million customer records from retail chain', primary: ['Data Breach'] },
  { title: 'Fixing memory leak in Chrome improves performance', primary: ['Other'], excludes: ['Data Breach'] },
  { title: 'Europol operation disrupts DDoS-for-hire services', primary: ['Other'], excludes: ['Outage'] },
  { title: 'CVE-2026-114713: UnrealIRCd Improper Neutralization of Delimiters Vulnerability', primary: ['Vulnerability/Zero-Day'] },
  { title: 'Power outage in Spain and Portugal blamed on grid failure, not cyberattack', primary: ['Infrastructure/Grid', 'Outage'], includes: ['Infrastructure/Grid', 'Outage'] },
  { title: 'OT security startup raises $30 million', primary: ['Infrastructure/Grid'] },
  { title: 'Railway Says Stolen Customer AI Keys Led to $740,000 in Estimated Unauthorized Usage Charges', primary: ['Data Breach'], excludes: ['Infrastructure/Grid'] },
  { title: 'SilentAir Hackers Intercept Calls, SMS From Inside Mobile Networks', primary: ['Infrastructure/Grid'] },
  { title: 'Hackers compromise 4,800 GitHub accounts to steal cloud credentials', primary: ['Data Breach'] },
  { title: 'Check Point gateways hacked via PHP2Shell to deploy VMware ESXi wiper', snippet: 'Vulnerable Check Point Security Gateway instances have been targeted in PHP2Shell attacks.', primary: ['Vulnerability/Zero-Day'] },
  { title: 'Tool lets scammers trains AI models on stolen voices', primary: ['Other', 'Data Breach'], excludes: ['Infrastructure/Grid'] },
];

describe('categorize', () => {
  for (const c of CASES) {
    it(c.title, () => {
      const got = categorize(c.title, c.snippet ?? '');
      assert.ok(got.length > 0);
      assert.ok(c.primary.includes(got[0]), `primary ${got[0]} not in [${c.primary}] (got [${got}])`);
      for (const inc of c.includes ?? []) assert.ok(got.includes(inc), `expected ${inc} in [${got}]`);
      for (const exc of c.excludes ?? []) assert.ok(!got.includes(exc), `did not expect ${exc} in [${got}]`);
      if (got.includes('Other')) assert.deepEqual(got, ['Other']);
    });
  }

  it('title matches outrank snippet-only matches', () => {
    const got = categorize('Ransomware gang claims attack', 'The group says it stole customer data and leaked files.');
    assert.equal(got[0], 'Ransomware');
    assert.ok(got.includes('Data Breach'));
  });

  it('source hints are included and outrank snippet-only matches', () => {
    const got = categorize('Siemens RUGGEDCOM APE1808', 'Palo Alto Networks has published information on vulnerabilities in PAN-OS.', {
      hints: ['Infrastructure/Grid', 'Vulnerability/Zero-Day'],
    });
    assert.deepEqual(got.slice(0, 2), ['Infrastructure/Grid', 'Vulnerability/Zero-Day']);
    assert.ok(!got.includes('Other'));
  });
});
