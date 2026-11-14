import type { ReactNode } from 'react';
import { GlitchText } from './GlitchText';
import { Stamp } from './Stamp';

/** Header block at the top of each inner page. The title is the page's <h1>. */
export function PageHeader(props: {
  fileNo: string;
  title: string;
  subtitle?: ReactNode;
  stamp?: string;
  children?: ReactNode;
}) {
  const { fileNo, title, subtitle, stamp, children } = props;
  return (
    <header className="page-header">
      <div className="page-header-text">
        <p className="eyebrow">// {fileNo}</p>
        <GlitchText as="h1" text={title} className="heading-crt page-header-title" />
        {subtitle ? <div className="page-header-sub">{subtitle}</div> : null}
      </div>
      {stamp || children ? (
        <div className="page-header-aside">
          {stamp ? (
            <Stamp size="lg" rotate={-6}>
              {stamp}
            </Stamp>
          ) : null}
          {children}
        </div>
      ) : null}
    </header>
  );
}
