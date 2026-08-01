import { Navigate, Route, Routes } from './lib/router';
import { AppShell } from './components/AppShell';
import { ErrorScreen, LoadingScreen } from './components/ui';
import { useWorkspace } from './state/WorkspaceContext';
import { AgentPage } from './pages/AgentPage';
import { DocumentsPage } from './pages/DocumentsPage';
import { IntroductionsPage } from './pages/IntroductionsPage';
import { InvestorDetailPage } from './pages/InvestorDetailPage';
import { InvestorsPage } from './pages/InvestorsPage';
import { KnowledgePage } from './pages/KnowledgePage';
import { ListsPage } from './pages/ListsPage';
import { MeetingsPage } from './pages/MeetingsPage';
import { OnboardingFlow } from './pages/OnboardingFlow';
import { OutreachPage } from './pages/OutreachPage';
import { PipelinePage } from './pages/PipelinePage';
import { ReviewPage } from './pages/ReviewPage';
import { RoundOverviewPage } from './pages/RoundOverviewPage';
import { SettingsPage } from './pages/SettingsPage';
import { TasksPage } from './pages/TasksPage';
import { UpNextPage } from './pages/UpNextPage';

export function App(): React.JSX.Element {
  const { data, loading, error, refreshing, refresh } = useWorkspace();

  if (loading) return <LoadingScreen />;
  if (error || !data)
    return (
      <ErrorScreen
        message={error ?? 'No workspace was returned.'}
        retrying={refreshing}
        retry={() => void refresh()}
      />
    );
  if (data.isFirstRun) return <OnboardingFlow />;

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<UpNextPage />} />
        <Route path="/round" element={<RoundOverviewPage />} />
        <Route path="/investors" element={<InvestorsPage />} />
        <Route path="/investors/:investorId" element={<InvestorDetailPage />} />
        <Route path="/pipeline" element={<PipelinePage />} />
        <Route path="/introductions" element={<IntroductionsPage />} />
        <Route path="/outreach" element={<OutreachPage />} />
        <Route path="/meetings" element={<MeetingsPage />} />
        <Route path="/knowledge" element={<KnowledgePage />} />
        <Route path="/agent" element={<AgentPage />} />
        <Route path="/review" element={<ReviewPage />} />
        <Route path="/lists" element={<ListsPage />} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/documents" element={<DocumentsPage />} />
        <Route path="/settings/*" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}
