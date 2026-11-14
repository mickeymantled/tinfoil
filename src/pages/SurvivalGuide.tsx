import '../styles/survival.css';
import { useEffect, useRef, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { Stamp } from '../components/Stamp';
import { Redacted } from '../components/Redacted';
import { PaperClip, CoffeeStain } from '../components/Decor';
import { usePageMeta } from '../lib/usePageMeta';
import { ALL_CHECKLIST_IDS, SURVIVAL_SECTIONS, SURVIVAL_SOURCES, rankFor } from '../data/survival';
import { useChecklist } from '../features/survival/useChecklist';
import { ScoreMeter, StickyScore } from '../features/survival/ScoreMeter';
import { ManualSection, sectionNo } from '../features/survival/ManualSection';

function Disclaimer({ position }: { position: 'top' | 'bottom' }) {
  return (
    <aside className="tm-disclaimer" aria-label={position === 'top' ? 'Disclaimer' : 'Disclaimer (repeated)'}>
      <p>
        <strong>Disclaimer:</strong> This is general preparedness information based on public guidance from the
        organizations listed under Source Documents. It is not professional, medical or legal advice. Always follow
        instructions from local officials. In an emergency, call 911 (or your local emergency number).
      </p>
    </aside>
  );
}

export default function SurvivalGuide() {
  usePageMeta({
    title: 'Survival Guide',
    description:
      'Field Manual TH-72: a practical grid-down preparedness guide with checklists for water, food, power, comms, cash, medical, shelter, fuel and digital prep. Based on Ready.gov, Red Cross, EPA, CDC and CISA guidance.',
  });

  const { checked, toggle, reset, count, total, percent } = useChecklist(ALL_CHECKLIST_IDS);
  const rank = rankFor(percent);

  // Announce rank changes only (not every checkbox) to avoid flooding screen readers.
  const [announcement, setAnnouncement] = useState('');
  const lastRank = useRef(rank.label);
  useEffect(() => {
    if (lastRank.current === rank.label) return;
    lastRank.current = rank.label;
    setAnnouncement(`Preparedness score ${percent} percent. New rank: ${rank.label}.`);
  }, [rank.label, percent]);

  // Show the slim sticky score bar only once the main score block has scrolled above the viewport.
  const scoreRef = useRef<HTMLDivElement>(null);
  const [stickyVisible, setStickyVisible] = useState(false);
  useEffect(() => {
    const el = scoreRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([entry]) => {
      setStickyVisible(!entry.isIntersecting && entry.boundingClientRect.top < 0);
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const [confirmReset, setConfirmReset] = useState(false);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const resetRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (confirmReset) confirmRef.current?.focus();
  }, [confirmReset]);

  const doReset = () => {
    reset();
    setConfirmReset(false);
    setAnnouncement('Checklist reset. Preparedness score 0 percent.');
    requestAnimationFrame(() => resetRef.current?.focus());
  };

  const cancelReset = () => {
    setConfirmReset(false);
    requestAnimationFrame(() => resetRef.current?.focus());
  };

  return (
    <div className="container-site py-8 sm:py-12">
      {/* Screen-only: the manual below carries its own print header. */}
      <div className="no-print">
        <PageHeader
          fileNo="FILE 004"
          title="SURVIVAL GUIDE"
          stamp="DECLASSIFIED"
          subtitle={
            <>
              They spent billions making the grid "smart." Nobody made you smart about the grid. Until now. Every fact in
              this manual comes straight from public government and Red Cross guidance. Check the sources.
            </>
          }
        />
      </div>

      <StickyScore percent={percent} count={count} total={total} visible={stickyVisible} />
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>

      <article className="paper tm-manual" aria-labelledby="tm-title">
        <PaperClip className="tm-clip" />
        <CoffeeStain className="tm-stain" />

        <header className="print-only tm-print-header">
          <p>TINFOIL HAT // FIELD MANUAL TH-72 // GRID-DOWN PREPAREDNESS</p>
          <p>
            Score at time of printing: {percent}% ({count} of {total} items checked). Rank: {rank.label}.
          </p>
        </header>

        <Disclaimer position="top" />

        <div className="tm-cover">
          <div className="tm-cover-stamp" aria-hidden="true">
            <Stamp tone="red" rotate={-10} size="lg">
              LEAKED
            </Stamp>
          </div>
          <p className="tm-docno">DOC. NO. TH-72/GRID/0013 // COPY 1 OF 1</p>
          <h2 id="tm-title" className="tm-title">
            Field Manual TH-72: Grid-Down Preparedness
          </h2>
          <p className="tm-cover-sub">
            What to do when a cyberattack, or anything else, takes down the power grid or other infrastructure.
          </p>
          <dl className="tm-meta">
            <div>
              <dt>Classification</dt>
              <dd>
                <Redacted>None. It is all public information. That is the scary part.</Redacted>
              </dd>
            </div>
            <div>
              <dt>Distribution</dt>
              <dd>
                <Redacted>Every group chat you are in.</Redacted>
              </dd>
            </div>
            <div>
              <dt>Recovered from</dt>
              <dd>
                <Redacted>A filing cabinet behind the substation. Do not ask.</Redacted>
              </dd>
            </div>
          </dl>

          <div ref={scoreRef}>
            <ScoreMeter percent={percent} count={count} total={total} />
          </div>

          <div className="tm-actions no-print">
            <button type="button" className="btn btn-paper" onClick={() => window.print()}>
              Print field manual
            </button>
            {!confirmReset ? (
              <button
                ref={resetRef}
                type="button"
                className="btn btn-paper tm-btn-reset"
                onClick={() => setConfirmReset(true)}
              >
                Reset checklist
              </button>
            ) : (
              <div className="tm-confirm" role="group" aria-label="Confirm reset">
                <p>{count === 0 ? 'Nothing is checked yet. Reset anyway?' : `Erase all ${count} checks? This cannot be undone.`}</p>
                <div className="tm-confirm-btns">
                  <button ref={confirmRef} type="button" className="btn btn-alert btn-sm" onClick={doReset}>
                    Yes, burn it
                  </button>
                  <button type="button" className="btn btn-paper btn-sm" onClick={cancelReset}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
          <p className="tm-saved-note no-print">
            Your checks are saved in this browser only. Nothing is sent anywhere. They cannot see it. Probably.
          </p>
        </div>

        <nav id="manual-index" className="tm-index" aria-labelledby="tm-index-title">
          <h2 id="tm-index-title" className="tm-index-title">
            Index of sections
          </h2>
          <ol>
            {SURVIVAL_SECTIONS.map((s) => {
              const done = s.checklist.filter((i) => checked[i.id]).length;
              return (
                <li key={s.id}>
                  <a href={`#${s.id}`}>
                    <span className="tm-index-no">{sectionNo(s.number)}</span>
                    <span className="tm-index-name">{s.title}</span>
                    <span className="tm-index-dots" aria-hidden="true" />
                    <span className="tm-index-prog">
                      <span aria-hidden="true">
                        {done}/{s.checklist.length}
                      </span>
                      <span className="sr-only">
                        , {done} of {s.checklist.length} done
                      </span>
                    </span>
                  </a>
                </li>
              );
            })}
            <li>
              <a href="#source-documents">
                <span className="tm-index-no">--</span>
                <span className="tm-index-name">Source documents</span>
                <span className="tm-index-dots" aria-hidden="true" />
              </a>
            </li>
          </ol>
        </nav>

        {SURVIVAL_SECTIONS.map((s) => (
          <ManualSection key={s.id} section={s} checked={checked} onToggle={toggle} />
        ))}

        <section id="source-documents" className="tm-section tm-sources" aria-labelledby="source-documents-title">
          <header className="tm-section-head">
            <div className="min-w-0">
              <p className="tm-secno">APPENDIX A</p>
              <h2 id="source-documents-title" className="tm-h2">
                Source documents
              </h2>
            </div>
          </header>
          <div className="tm-body">
            <p className="tm-intro">
              Do not trust us. Trust nobody. Then go read the originals, because these ones are actually public.
            </p>
            {SURVIVAL_SOURCES.map((group) => (
              <div key={group.org} className="tm-block">
                <h3 className="tm-h3">{group.org}</h3>
                <ul className="tm-ul tm-source-list">
                  {group.links.map((link) => (
                    <li key={link.url}>
                      <a href={link.url} target="_blank" rel="noopener noreferrer" className="tm-source-link">
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <Disclaimer position="bottom" />
        <p className="tm-endmark" aria-hidden="true">
          {'// END OF DOCUMENT //'}
        </p>
      </article>
    </div>
  );
}
