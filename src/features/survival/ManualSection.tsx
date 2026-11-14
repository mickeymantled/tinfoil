import type { BriefingBlock, SurvivalSection } from '../../data/survival';

export function sectionNo(n: number): string {
  return String(n).padStart(2, '0');
}

function Block({ block }: { block: BriefingBlock }) {
  switch (block.kind) {
    case 'p':
      return <p className="tm-p">{block.text}</p>;
    case 'list': {
      const List = block.ordered ? 'ol' : 'ul';
      return (
        <div className="tm-block">
          {block.heading && <h3 className="tm-h3">{block.heading}</h3>}
          <List className={block.ordered ? 'tm-ol' : 'tm-ul'}>
            {block.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </List>
        </div>
      );
    }
    case 'warning':
      return (
        <div className="tm-warning" role="note">
          <h3 className="tm-warning-title">
            <span className="tm-warning-flag">WARNING</span> {block.title}
          </h3>
          {block.text && <p className="tm-p">{block.text}</p>}
          {block.items && (
            <ul className="tm-ul">
              {block.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </div>
      );
    case 'table':
      return (
        <div className="tm-block tm-table-wrap">
          <table className="tm-table">
            <caption>{block.caption}</caption>
            <thead>
              <tr>
                {block.headers.map((h) => (
                  <th key={h} scope="col">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row) => (
                <tr key={row[0]}>
                  {row.map((cell, i) =>
                    i === 0 ? (
                      <th key={i} scope="row">
                        {cell}
                      </th>
                    ) : (
                      <td key={i}>{cell}</td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {block.note && <p className="tm-table-note">{block.note}</p>}
        </div>
      );
  }
}

interface Props {
  section: SurvivalSection;
  checked: Record<string, true>;
  onToggle: (id: string, value: boolean) => void;
}

export function ManualSection({ section, checked, onToggle }: Props) {
  const done = section.checklist.filter((i) => checked[i.id]).length;
  const total = section.checklist.length;
  const titleId = `${section.id}-title`;

  return (
    <section id={section.id} className="tm-section" aria-labelledby={titleId}>
      <header className="tm-section-head">
        <div className="min-w-0">
          <p className="tm-secno">SECTION {sectionNo(section.number)}</p>
          <h2 id={titleId} className="tm-h2">
            {section.title}
          </h2>
        </div>
        <p className="tm-progress" data-complete={done === total ? 'true' : 'false'}>
          <span aria-hidden="true">
            {done}/{total}
          </span>
          <span className="sr-only">
            {done} of {total} checklist items done
          </span>
        </p>
      </header>

      <div className="tm-section-grid">
        <div className="tm-body">
          <p className="tm-codename">
            CODENAME: <span>{section.codename}</span>
          </p>
          <p className="tm-intro">{section.intro}</p>

          {section.timeline && (
            <ol className="tm-timeline">
              {section.timeline.map((phase) => (
                <li key={phase.label} className="tm-phase">
                  <h3 className="tm-phase-label">{phase.label}</h3>
                  <ul className="tm-ul">
                    {phase.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          )}

          {section.briefing.map((block, i) => (
            <Block key={i} block={block} />
          ))}

          <fieldset className="tm-checklist">
            <legend className="tm-checklist-legend">
              Checklist: {section.title}
              <span className="tm-checklist-count" aria-hidden="true">
                {' '}
                ({done}/{total})
              </span>
            </legend>
            <ul>
              {section.checklist.map((item) => {
                const inputId = `chk-${item.id}`;
                return (
                  <li key={item.id}>
                    <label htmlFor={inputId} className="tm-item">
                      <input
                        id={inputId}
                        type="checkbox"
                        className="tm-check"
                        checked={Boolean(checked[item.id])}
                        onChange={(e) => onToggle(item.id, e.currentTarget.checked)}
                      />
                      <span className="tm-item-text">
                        <span className="tm-item-label">{item.label}</span>
                        {item.detail && <span className="tm-item-detail">{item.detail}</span>}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        </div>

        {section.marginNote && (
          <aside className="tm-margin" aria-label="Margin note">
            <p>{section.marginNote}</p>
          </aside>
        )}
      </div>
    </section>
  );
}
