import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, ExternalLink, ShieldCheck } from 'lucide-react';
import { createDemoWorkspace } from '../lib/demo-data';
import { loadPublicShowcase } from '../lib/portal-api';
import { demoMode, portalConfigured } from '../lib/supabase';
import type { PublicShowcaseData } from '../lib/types';
import { Badge, BrandMark, Button, EmptyState } from '../components/Primitives';

function demoPublicShowcase(): PublicShowcaseData {
  const workspace = createDemoWorkspace('bot_chain_viewer');
  const showcaseItems = workspace.showcaseItems.filter((item) => item.visibility === 'public');
  const projectIds = new Set(showcaseItems.map((item) => item.projectId));
  return {
    projects: workspace.projects.filter((project) => projectIds.has(project.id)),
    showcaseItems,
  };
}

export function PublicShowcasePage(): React.JSX.Element {
  const [data, setData] = useState<PublicShowcaseData | null>(() =>
    demoMode ? demoPublicShowcase() : null,
  );
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (demoMode || !portalConfigured) return;
    void loadPublicShowcase()
      .then(setData)
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : 'The showcase could not be loaded.'),
      );
  }, []);
  const projects = useMemo(
    () => new Map(data?.projects.map((project) => [project.id, project]) ?? []),
    [data],
  );
  return (
    <main className="public-showcase-page">
      <nav>
        <a href="/" className="brand-lockup brand-lockup--public">
          <BrandMark />
          <strong>Bot Combinator</strong>
        </a>
        <a href="/">
          Team sign in <ArrowRight aria-hidden="true" />
        </a>
      </nav>
      <header className="public-showcase-hero">
        <div>
          <Badge tone="lime" dot>
            Project-approved work
          </Badge>
          <h1>Products moving from useful agents to open markets.</h1>
          <p>
            A curated view of what Bot Combinator teams are building. Every item here was explicitly
            shared by its project and approved through Klineo.
          </p>
        </div>
        <aside>
          <ShieldCheck aria-hidden="true" />
          <span>
            <strong>Public means intentional</strong>
            <small>
              No private team contacts, fundraising data, internal notes, or unpublished progress.
            </small>
          </span>
        </aside>
      </header>
      {error ? <EmptyState title="Showcase unavailable" detail={error} /> : null}
      {!data && !error ? (
        <div className="public-showcase-loading">Loading approved work…</div>
      ) : null}
      {data ? (
        <section className="public-showcase-grid">
          {data.showcaseItems.map((item, index) => {
            const project = projects.get(item.projectId);
            const asset = item.assets[0];
            return (
              <article key={item.id} className={index === 0 ? 'is-featured' : undefined}>
                {asset?.signedUrl ? (
                  <a href={asset.signedUrl} target="_blank" rel="noreferrer">
                    <img
                      src={asset.signedUrl}
                      alt={`${project?.name ?? 'Project'} — ${item.title}`}
                    />
                  </a>
                ) : (
                  <div className="public-showcase-link">
                    <span>{item.type.toUpperCase()}</span>
                  </div>
                )}
                <div>
                  <header>
                    <span style={{ background: project?.accent }}>
                      {project?.name.slice(0, 2).toUpperCase()}
                    </span>
                    <small>{project?.name}</small>
                  </header>
                  <h2>{item.title}</h2>
                  <p>{item.description}</p>
                  {item.url ? (
                    <a href={item.url} target="_blank" rel="noreferrer">
                      Visit product <ExternalLink aria-hidden="true" />
                    </a>
                  ) : (
                    <Button
                      tone="quiet"
                      onClick={() =>
                        asset?.signedUrl &&
                        window.open(asset.signedUrl, '_blank', 'noopener,noreferrer')
                      }
                    >
                      View screenshot
                    </Button>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      ) : null}
      <footer className="public-showcase-footer">
        <div className="brand-lockup">
          <BrandMark />
          <strong>Bot Combinator</strong>
        </div>
        <p>Klineo × BOT Chain ecosystem program</p>
        <a href="/">
          Private portal <ArrowRight aria-hidden="true" />
        </a>
      </footer>
    </main>
  );
}
