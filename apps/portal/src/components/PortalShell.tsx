import type { PropsWithChildren, ReactNode } from 'react';
import {
  Activity,
  Blocks,
  ChevronDown,
  Eye,
  FolderKanban,
  GalleryHorizontalEnd,
  HardDriveDownload,
  LayoutDashboard,
  LogOut,
  MessageSquareText,
  RefreshCw,
  UserCog,
  UsersRound,
} from 'lucide-react';
import type { PortalRole, PortalUser } from '../lib/types';
import { isBotChainRole, isKlineoOperatorRole, isKlineoRole } from '../lib/visibility';
import { Avatar, Badge, BrandMark, Button, cx, titleCase } from './Primitives';

export type PortalRoute =
  | 'dashboard'
  | 'projects'
  | 'reviews'
  | 'cohorts'
  | 'access'
  | 'activity'
  | 'showcase'
  | 'downloads';

interface NavItem {
  route: PortalRoute;
  label: string;
  icon: ReactNode;
}

function navForRole(role: PortalRole): NavItem[] {
  if (isKlineoRole(role)) {
    const navigation: NavItem[] = [
      { route: 'dashboard', label: 'Command center', icon: <LayoutDashboard aria-hidden="true" /> },
      { route: 'projects', label: 'Projects', icon: <FolderKanban aria-hidden="true" /> },
      {
        route: 'downloads',
        label: 'Desktop app',
        icon: <HardDriveDownload aria-hidden="true" />,
      },
      { route: 'reviews', label: 'Review queue', icon: <MessageSquareText aria-hidden="true" /> },
      { route: 'cohorts', label: 'Cohorts', icon: <UsersRound aria-hidden="true" /> },
      { route: 'showcase', label: 'Showcase', icon: <GalleryHorizontalEnd aria-hidden="true" /> },
      { route: 'activity', label: 'Audit history', icon: <Activity aria-hidden="true" /> },
    ];
    if (isKlineoOperatorRole(role)) {
      navigation.splice(5, 0, {
        route: 'access',
        label: 'People & access',
        icon: <UserCog aria-hidden="true" />,
      });
    }
    return navigation;
  }
  if (isBotChainRole(role)) {
    return [
      { route: 'dashboard', label: 'Partner overview', icon: <Eye aria-hidden="true" /> },
      { route: 'projects', label: 'Approved projects', icon: <FolderKanban aria-hidden="true" /> },
      {
        route: 'showcase',
        label: 'Approved showcase',
        icon: <GalleryHorizontalEnd aria-hidden="true" />,
      },
    ];
  }
  return [
    { route: 'dashboard', label: 'Project home', icon: <LayoutDashboard aria-hidden="true" /> },
    { route: 'projects', label: 'Product workspace', icon: <Blocks aria-hidden="true" /> },
    {
      route: 'downloads',
      label: 'Desktop app',
      icon: <HardDriveDownload aria-hidden="true" />,
    },
    {
      route: 'reviews',
      label: 'Reviews & sharing',
      icon: <MessageSquareText aria-hidden="true" />,
    },
    { route: 'showcase', label: 'Showcase', icon: <GalleryHorizontalEnd aria-hidden="true" /> },
  ];
}

const DEMO_ROLES: PortalRole[] = ['klineo_admin', 'project_lead', 'bot_chain_reviewer'];

export function PortalShell({
  user,
  route,
  demo,
  reviewCount,
  onRoute,
  onSwitchRole,
  onRefresh,
  onSignOut,
  children,
}: PropsWithChildren<{
  user: PortalUser;
  route: PortalRoute;
  demo: boolean;
  reviewCount: number;
  onRoute: (route: PortalRoute) => void;
  onSwitchRole: (role: PortalRole) => void;
  onRefresh: () => void;
  onSignOut: () => void;
}>): React.JSX.Element {
  const nav = navForRole(user.role);
  const roleLabel = isKlineoRole(user.role)
    ? 'Klineo program'
    : isBotChainRole(user.role)
      ? 'BOT Chain partner'
      : 'Project team';
  return (
    <div className="portal-shell">
      <aside className="sidebar">
        <div className="brand-lockup brand-lockup--sidebar">
          <BrandMark />
          <div>
            <strong>Bot Combinator</strong>
            <small>Collaboration portal</small>
          </div>
        </div>

        <div className="workspace-switcher">
          <span className="workspace-switcher__mark">
            {user.organizationName.slice(0, 2).toUpperCase()}
          </span>
          <div>
            <small>{roleLabel}</small>
            <strong>{user.organizationName}</strong>
          </div>
          <ChevronDown aria-hidden="true" />
        </div>

        <nav aria-label="Portal navigation">
          {nav.map((item) => (
            <button
              type="button"
              key={item.route}
              className={cx(route === item.route && 'is-active')}
              onClick={() => onRoute(item.route)}
              aria-current={route === item.route ? 'page' : undefined}
              title={item.label}
            >
              {item.icon}
              <span>{item.label}</span>
              {item.route === 'reviews' && reviewCount > 0 ? <i>{reviewCount}</i> : null}
            </button>
          ))}
        </nav>

        <div className="sidebar__footer">
          <div className="privacy-state">
            <span>
              <i />
            </span>
            <div>
              <strong>Private by default</strong>
              <small>Sharing requires an explicit action</small>
            </div>
          </div>
          <div className="user-menu">
            <Avatar name={user.fullName} />
            <div>
              <strong>{user.fullName}</strong>
              <small>{titleCase(user.role)}</small>
            </div>
            {!demo ? (
              <button type="button" onClick={onSignOut} aria-label="Sign out">
                <LogOut aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </div>
      </aside>

      <div className="portal-main">
        <header className="topbar">
          <div>
            {demo ? (
              <Badge tone="warning" dot>
                Interactive preview
              </Badge>
            ) : (
              <Badge tone="success" dot>
                Production workspace
              </Badge>
            )}
          </div>
          <div className="topbar__actions">
            {demo ? (
              <label className="role-preview">
                <span>View as</span>
                <select
                  value={DEMO_ROLES.includes(user.role) ? user.role : 'klineo_admin'}
                  onChange={(event) => onSwitchRole(event.target.value as PortalRole)}
                >
                  <option value="klineo_admin">Klineo</option>
                  <option value="project_lead">Atlas Pay team</option>
                  <option value="bot_chain_reviewer">BOT Chain</option>
                </select>
              </label>
            ) : null}
            <Button
              size="small"
              tone="quiet"
              icon={<RefreshCw aria-hidden="true" />}
              onClick={onRefresh}
            >
              Refresh
            </Button>
          </div>
        </header>
        <main className="workspace-canvas">{children}</main>
      </div>
    </div>
  );
}
