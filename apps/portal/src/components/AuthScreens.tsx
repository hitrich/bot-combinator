import { useState } from 'react';
import { ArrowRight, Check, Database, Image, KeyRound, ShieldCheck } from 'lucide-react';
import { Button, Field } from './Primitives';

export function SignInScreen({
  onSubmit,
}: {
  onSubmit: (email: string) => Promise<void>;
}): React.JSX.Element {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (): Promise<void> => {
    if (!email.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(email);
      setSent(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The sign-in link could not be sent.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-poster">
        <div className="brand-lockup brand-lockup--light">
          <span>BC</span>
          <strong>Bot Combinator</strong>
        </div>
        <div className="auth-poster__statement">
          <span>Private collaboration portal</span>
          <h1>Progress without exposing the private workspace.</h1>
          <p>
            Project teams share intentionally. Klineo reviews. BOT Chain sees only approved work.
          </p>
        </div>
        <div className="auth-poster__signal" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
      </section>
      <section className="auth-form-wrap">
        <div className="auth-form">
          <span className="eyebrow">Invitation required</span>
          <h2>{sent ? 'Check your inbox' : 'Sign in to your workspace'}</h2>
          <p>
            {sent
              ? `A secure sign-in link was sent to ${email}. It expires automatically.`
              : 'Use the email address from your Klineo invitation. No password is stored.'}
          </p>
          {sent ? (
            <div className="sent-state">
              <span>
                <Check aria-hidden="true" />
              </span>
              <p>You can close this tab after opening the link.</p>
              <Button tone="quiet" onClick={() => setSent(false)}>
                Use another email
              </Button>
            </div>
          ) : (
            <div className="stack stack--large">
              <Field label="Work email">
                <input
                  className="input input--large"
                  type="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void submit();
                  }}
                />
              </Field>
              {error ? <p className="form-error">{error}</p> : null}
              <Button
                tone="primary"
                disabled={!email.trim() || busy}
                onClick={() => void submit()}
                icon={<ArrowRight aria-hidden="true" />}
              >
                {busy ? 'Sending…' : 'Email me a secure link'}
              </Button>
            </div>
          )}
          <small className="auth-form__footnote">
            Access is restricted by organization, project membership, and record visibility.
          </small>
        </div>
      </section>
    </main>
  );
}

export function ConfigurationScreen(): React.JSX.Element {
  return (
    <main className="setup-page">
      <header className="setup-page__header">
        <div className="brand-lockup">
          <span>BC</span>
          <strong>Bot Combinator</strong>
        </div>
        <span className="eyebrow">Production setup required</span>
      </header>
      <section className="setup-page__intro">
        <p>Hosted collaboration portal</p>
        <h1>Connect the production data plane.</h1>
        <p>
          The interface is built. Add a Supabase project and the deployment variables below before
          inviting real teams.
        </p>
      </section>
      <section className="setup-steps">
        <article>
          <span>
            <Database aria-hidden="true" />
          </span>
          <div>
            <small>01</small>
            <h2>Apply the migration</h2>
            <p>Run the included SQL against a managed PostgreSQL project.</p>
          </div>
        </article>
        <article>
          <span>
            <KeyRound aria-hidden="true" />
          </span>
          <div>
            <small>02</small>
            <h2>Add public client variables</h2>
            <p>Set the Supabase URL, publishable key, and portal URL in hosting.</p>
          </div>
        </article>
        <article>
          <span>
            <Image aria-hidden="true" />
          </span>
          <div>
            <small>03</small>
            <h2>Verify private storage</h2>
            <p>The migration creates a private, signed-URL screenshot bucket.</p>
          </div>
        </article>
        <article>
          <span>
            <ShieldCheck aria-hidden="true" />
          </span>
          <div>
            <small>04</small>
            <h2>Bootstrap Klineo</h2>
            <p>Create the first admin, then invite projects and BOT Chain from the portal.</p>
          </div>
        </article>
      </section>
      <pre>
        VITE_SUPABASE_URL=https://…{`\n`}VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_…{`\n`}
        VITE_PORTAL_URL=https://portal.example.com
      </pre>
    </main>
  );
}

export function LoadingScreen(): React.JSX.Element {
  return (
    <main className="loading-page">
      <div className="brand-lockup">
        <span>BC</span>
        <strong>Bot Combinator</strong>
      </div>
      <div className="loading-rule">
        <i />
      </div>
      <p>Opening your authorized workspace…</p>
    </main>
  );
}
