import { Link } from 'react-router-dom';
import { GlitchText } from '../components/GlitchText';
import { Stamp } from '../components/Stamp';
import { usePageMeta } from '../lib/usePageMeta';

export default function NotFound() {
  usePageMeta({ title: 'File not found', description: 'This file does not exist. Or it was removed.' });
  return (
    <div className="container-site py-8 sm:py-12">
      <div className="paper mx-auto max-w-2xl">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-typeink/70">// ERROR 404</p>
        <GlitchText as="h1" text="FILE NOT FOUND." className="heading-type mt-3 text-3xl sm:text-4xl" />
        <p className="mt-4">
          Or was it removed? Whatever was at this address is gone. No record, no trace, no comment from officials.
          That is exactly what they would want you to think.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-5">
          <Link to="/" className="btn btn-paper">
            Return to base
          </Link>
          <Stamp tone="red" rotate={-4}>
            Missing
          </Stamp>
        </div>
      </div>
    </div>
  );
}
