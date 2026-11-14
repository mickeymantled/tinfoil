import { config } from '../../config';
import { Stamp } from '../../components/Stamp';
import { Redacted } from '../../components/Redacted';

export function Dossier() {
  return (
    <section className="home-section" aria-labelledby="what-title">
      <div className="panel home-brief">
        <div className="panel-title home-brief__strip">
          <span className="home-brief__file">// FILE 001-B: BRIEFING</span>
          <span className="home-brief__clearance">CLEARANCE: PUBLIC</span>
        </div>

        <div className="home-brief__head">
          <h2 id="what-title" className="heading-crt home-brief__title">
            WHAT IS THIS?
          </h2>
          {/* In normal flow (not absolutely positioned) so it can never cover text. */}
          <Stamp tone="red" rotate={-6} size="sm">
            TOP SECRET
          </Stamp>
        </div>

        <div className="home-brief__body">
          <p>
            If you are reading this, you got past the firewall. Good. Here is the truth they buried:{' '}
            <strong>
              {config.tokenName} ({config.ticker}) is a memecoin on {config.chain}.
            </strong>{' '}
            A meme with a ticker. It is not an investment, it promises nothing, and the hat does not actually block{' '}
            <Redacted dark>the 5G mind beams. We checked.</Redacted>
          </p>
          <p>
            But this is not just a coin. We built three real tools for the awake: a <strong>live monitor</strong> of real
            cyber incidents, pulled from public security reporting with every headline shown as published and linked to
            its source; a <strong>grid-down survival guide</strong> based on public preparedness guidance from Ready.gov
            and the Red Cross; and a <strong>hat generator</strong> that puts a tinfoil hat on your profile picture, right
            in your browser.
          </p>
          <p>
            So nobody gets confused, here is where the facts end. The incident reports are real. The survival advice is
            real. Everything else, including the THREAT LEVEL, the surveillance readout and the{' '}
            <Redacted dark>pigeons on the roof taking notes</Redacted>, is a bit.
          </p>
          <p>
            Wear the hat anyway. <Redacted dark>They hate it when you wear the hat.</Redacted>
          </p>
        </div>

        <p className="home-brief__foot">Not financial advice. Not any kind of advice. Just a hat.</p>
      </div>
    </section>
  );
}
