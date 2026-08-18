import { useState } from 'react';
import { ArrowRight, Check, Database, Image, KeyRound, Send, ShieldCheck } from 'lucide-react';
import type { ProjectApplicationInput } from '../lib/types';
import { BrandMark, Button, Dialog, Field } from './Primitives';

const EMPTY_APPLICATION: ProjectApplicationInput = {
  projectName: '',
  applicantName: '',
  applicantEmail: '',
  roleTitle: null,
  websiteUrl: null,
  productStage: 'prototype',
  teamSize: null,
  productSummary: '',
  programGoals: '',
  middleName: '',
};

export function SignInScreen({
  onSubmit,
  onApply,
}: {
  onSubmit: (email: string) => Promise<void>;
  onApply: (input: ProjectApplicationInput) => Promise<string>;
}): React.JSX.Element {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applicationOpen, setApplicationOpen] = useState(false);
  const [application, setApplication] = useState<ProjectApplicationInput>(EMPTY_APPLICATION);
  const [applicationBusy, setApplicationBusy] = useState(false);
  const [applicationError, setApplicationError] = useState<string | null>(null);
  const [applicationReference, setApplicationReference] = useState<string | null>(null);

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

  const applicationReady =
    application.projectName.trim().length >= 2 &&
    application.applicantName.trim().length >= 2 &&
    application.applicantEmail.includes('@') &&
    application.productSummary.trim().length >= 20 &&
    application.programGoals.trim().length >= 20;

  const submitApplication = async (): Promise<void> => {
    if (!applicationReady || applicationBusy) return;
    setApplicationBusy(true);
    setApplicationError(null);
    try {
      const reference = await onApply(application);
      setApplicationReference(reference);
    } catch (cause) {
      setApplicationError(
        cause instanceof Error ? cause.message : 'The application could not be submitted.',
      );
    } finally {
      setApplicationBusy(false);
    }
  };

  const closeApplication = (): void => {
    if (applicationBusy) return;
    setApplicationOpen(false);
    if (applicationReference) {
      setApplication(EMPTY_APPLICATION);
      setApplicationReference(null);
    }
    setApplicationError(null);
  };

  return (
    <main className="auth-page">
      <section className="auth-poster">
        <div className="brand-lockup brand-lockup--light">
          <BrandMark />
          <strong>Bot Combinator</strong>
        </div>
        <div className="auth-poster__statement">
          <span>Applications for project teams</span>
          <h1>Build what’s next with Bot Combinator.</h1>
          <p>
            Apply to join Klineo’s builder program, turn product progress into clear milestones, and
            prepare approved work for the BOT Chain ecosystem.
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
          <div className="auth-form__apply">
            <span className="eyebrow">Next cohort</span>
            <h2>Apply to Bot Combinator</h2>
            <p>
              Share what you are building and where you want to go. Klineo reviews every
              application.
            </p>
            <Button
              className="button--apply"
              onClick={() => setApplicationOpen(true)}
              icon={<ArrowRight aria-hidden="true" />}
            >
              Start your application
            </Button>
          </div>

          <div className="auth-form__divider">
            <span>Already invited?</span>
          </div>

          <div className="auth-form__signin">
            <span className="eyebrow">Member access</span>
            <h3>{sent ? 'Check your inbox' : 'Sign in to your workspace'}</h3>
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
          </div>
          <small className="auth-form__footnote">
            Applications are visible only to Klineo. Member access remains restricted by
            organization and project.
          </small>
        </div>
      </section>

      <Dialog
        open={applicationOpen}
        wide
        title="Apply to Bot Combinator"
        description="Tell Klineo what you are building and what the program can help you unlock. Application details are never shared with BOT Chain or the public."
        onClose={closeApplication}
        footer={
          applicationReference ? (
            <Button tone="primary" onClick={closeApplication}>
              Done
            </Button>
          ) : (
            <>
              <Button disabled={applicationBusy} onClick={closeApplication}>
                Cancel
              </Button>
              <Button
                tone="primary"
                type="submit"
                form="bot-combinator-application"
                disabled={!applicationReady || applicationBusy}
                icon={<Send aria-hidden="true" />}
              >
                {applicationBusy ? 'Submitting…' : 'Submit application'}
              </Button>
            </>
          )
        }
      >
        {applicationReference ? (
          <div className="application-success">
            <span>
              <Check aria-hidden="true" />
            </span>
            <div>
              <h3>Your application is with Klineo.</h3>
              <p>
                The team will review it and contact you at {application.applicantEmail}. Keep this
                reference for your records.
              </p>
              <code>BC-{applicationReference.slice(0, 8).toUpperCase()}</code>
            </div>
          </div>
        ) : (
          <form
            id="bot-combinator-application"
            className="application-form form-grid"
            onSubmit={(event) => {
              event.preventDefault();
              void submitApplication();
            }}
          >
            <Field label="Project name">
              <input
                className="input"
                required
                minLength={2}
                maxLength={120}
                autoComplete="organization"
                placeholder="Your product or company"
                value={application.projectName}
                onChange={(event) =>
                  setApplication((current) => ({ ...current, projectName: event.target.value }))
                }
              />
            </Field>
            <Field label="Your name">
              <input
                className="input"
                required
                minLength={2}
                maxLength={120}
                autoComplete="name"
                placeholder="Full name"
                value={application.applicantName}
                onChange={(event) =>
                  setApplication((current) => ({ ...current, applicantName: event.target.value }))
                }
              />
            </Field>
            <Field label="Work email">
              <input
                className="input"
                type="email"
                required
                maxLength={320}
                autoComplete="email"
                placeholder="you@company.com"
                value={application.applicantEmail}
                onChange={(event) =>
                  setApplication((current) => ({ ...current, applicantEmail: event.target.value }))
                }
              />
            </Field>
            <Field label="Your role" hint="Optional">
              <input
                className="input"
                maxLength={120}
                autoComplete="organization-title"
                placeholder="Founder, product lead…"
                value={application.roleTitle ?? ''}
                onChange={(event) =>
                  setApplication((current) => ({
                    ...current,
                    roleTitle: event.target.value || null,
                  }))
                }
              />
            </Field>
            <Field label="Product website" hint="Optional">
              <input
                className="input"
                type="url"
                maxLength={2048}
                autoComplete="url"
                placeholder="https://"
                value={application.websiteUrl ?? ''}
                onChange={(event) =>
                  setApplication((current) => ({
                    ...current,
                    websiteUrl: event.target.value || null,
                  }))
                }
              />
            </Field>
            <Field label="Current product stage">
              <select
                className="select"
                value={application.productStage}
                onChange={(event) =>
                  setApplication((current) => ({
                    ...current,
                    productStage: event.target.value as ProjectApplicationInput['productStage'],
                  }))
                }
              >
                <option value="idea">Idea</option>
                <option value="prototype">Prototype</option>
                <option value="beta">Beta</option>
                <option value="live">Live product</option>
              </select>
            </Field>
            <Field label="Team size" hint="Optional">
              <input
                className="input"
                type="number"
                min={1}
                max={500}
                placeholder="3"
                value={application.teamSize ?? ''}
                onChange={(event) =>
                  setApplication((current) => ({
                    ...current,
                    teamSize: event.target.value ? Number(event.target.value) : null,
                  }))
                }
              />
            </Field>
            <Field label="What are you building?" hint="20–2,000 characters" span>
              <textarea
                className="textarea"
                required
                minLength={20}
                maxLength={2000}
                placeholder="Describe the product, the customer, and the problem you solve."
                value={application.productSummary}
                onChange={(event) =>
                  setApplication((current) => ({
                    ...current,
                    productSummary: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Why Bot Combinator?" hint="20–2,000 characters" span>
              <textarea
                className="textarea"
                required
                minLength={20}
                maxLength={2000}
                placeholder="What should Klineo help you achieve during the program?"
                value={application.programGoals}
                onChange={(event) =>
                  setApplication((current) => ({ ...current, programGoals: event.target.value }))
                }
              />
            </Field>
            <label className="application-honeypot" aria-hidden="true">
              Middle name
              <input
                tabIndex={-1}
                autoComplete="off"
                value={application.middleName}
                onChange={(event) =>
                  setApplication((current) => ({ ...current, middleName: event.target.value }))
                }
              />
            </label>
            <div className="form-notice form-notice--span">
              <ShieldCheck aria-hidden="true" />
              <p>
                Your application is private to Klineo program members. Submitting does not create a
                public profile or share anything with BOT Chain.
              </p>
            </div>
            {applicationError ? <p className="form-error field--span">{applicationError}</p> : null}
          </form>
        )}
      </Dialog>
    </main>
  );
}

export function ConfigurationScreen(): React.JSX.Element {
  return (
    <main className="setup-page">
      <header className="setup-page__header">
        <div className="brand-lockup">
          <BrandMark />
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
        <BrandMark />
        <strong>Bot Combinator</strong>
      </div>
      <div className="loading-rule">
        <i />
      </div>
      <p>Opening your authorized workspace…</p>
    </main>
  );
}
