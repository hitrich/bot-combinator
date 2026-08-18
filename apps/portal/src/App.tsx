import { useCallback, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { ConfigurationScreen, LoadingScreen, SignInScreen } from './components/AuthScreens';
import { Button } from './components/Primitives';
import { PortalShell, type PortalRoute } from './components/PortalShell';
import { usePortal } from './state/PortalContext';
import { DashboardView } from './views/DashboardView';
import { DesktopDownloadsView } from './views/DesktopDownloadsView';
import { ProjectView } from './views/ProjectView';
import { PublicShowcasePage } from './views/PublicShowcasePage';
import {
  ActivityView,
  CohortsView,
  ProjectsView,
  ReviewsView,
  ShowcaseView,
} from './views/PortfolioViews';

type ProjectAction = 'update' | 'showcase' | 'import' | null;

export default function App(): React.JSX.Element {
  const portal = usePortal();
  const [route, setRoute] = useState<PortalRoute>('dashboard');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [projectDetailOpen, setProjectDetailOpen] = useState(false);
  const [projectAction, setProjectAction] = useState<ProjectAction>(null);

  const openProject = useCallback((projectId: string) => {
    setSelectedProjectId(projectId);
    setProjectDetailOpen(true);
    setRoute('projects');
  }, []);

  const openProjectAction = useCallback(
    (action: Exclude<ProjectAction, null>) => {
      const projectId = portal.workspace?.projects[0]?.id;
      if (!projectId) return;
      setSelectedProjectId(projectId);
      setProjectDetailOpen(true);
      setProjectAction(action);
      setRoute('projects');
    },
    [portal.workspace?.projects],
  );

  if (window.location.pathname === '/showcase') return <PublicShowcasePage />;

  if (!portal.configured && !portal.demo) return <ConfigurationScreen />;
  if (portal.loading) return <LoadingScreen />;
  if (!portal.demo && !portal.session) {
    return <SignInScreen onSubmit={portal.sendMagicLink} onApply={portal.submitApplication} />;
  }
  if (!portal.workspace) {
    return (
      <main className="fatal-page">
        <AlertTriangle aria-hidden="true" />
        <h1>Workspace unavailable</h1>
        <p>{portal.error ?? 'Your account has no active portal membership.'}</p>
        <Button onClick={() => void portal.refresh()}>Try again</Button>
      </main>
    );
  }

  const workspace = portal.workspace;
  const selectedProject =
    workspace.projects.find((project) => project.id === selectedProjectId) ?? workspace.projects[0];
  const activeReviews =
    workspace.reviewRequests.filter((review) => !['approved', 'closed'].includes(review.status))
      .length +
    workspace.visibilityApprovals.filter((approval) => approval.status === 'requested').length;

  return (
    <PortalShell
      user={workspace.user}
      route={route}
      demo={portal.demo}
      reviewCount={activeReviews}
      onRoute={(nextRoute) => {
        setRoute(nextRoute);
        setProjectDetailOpen(false);
      }}
      onSwitchRole={(role) => {
        portal.switchDemoRole(role);
        setRoute('dashboard');
        setProjectDetailOpen(false);
        setSelectedProjectId(null);
      }}
      onRefresh={() => void portal.refresh()}
      onSignOut={() => void portal.signOut()}
    >
      {route === 'dashboard' ? (
        <DashboardView
          workspace={workspace}
          onOpenProject={openProject}
          onSubmitProgress={() => openProjectAction('update')}
          onOpenReviews={() => setRoute('reviews')}
        />
      ) : null}
      {route === 'projects' && projectDetailOpen && selectedProject ? (
        <ProjectView
          projectId={selectedProject.id}
          startAction={projectAction}
          onActionConsumed={() => setProjectAction(null)}
          onBack={() => setProjectDetailOpen(false)}
        />
      ) : null}
      {route === 'projects' && !projectDetailOpen ? (
        <ProjectsView workspace={workspace} onOpenProject={openProject} />
      ) : null}
      {route === 'reviews' ? <ReviewsView workspace={workspace} /> : null}
      {route === 'cohorts' ? <CohortsView workspace={workspace} /> : null}
      {route === 'showcase' ? (
        <ShowcaseView workspace={workspace} onOpenProject={openProject} />
      ) : null}
      {route === 'activity' ? <ActivityView workspace={workspace} /> : null}
      {route === 'downloads' ? <DesktopDownloadsView /> : null}

      <div className="toast-region" aria-live="polite">
        {portal.toasts.map((toast) => (
          <div key={toast.id} className={`toast toast--${toast.tone}`}>
            <span>
              <strong>{toast.title}</strong>
              {toast.detail ? <p>{toast.detail}</p> : null}
            </span>
            <button
              type="button"
              onClick={() => portal.dismissToast(toast.id)}
              aria-label="Dismiss notification"
            >
              <X aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </PortalShell>
  );
}
