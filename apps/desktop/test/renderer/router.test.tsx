import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  HashRouter,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from '../../src/renderer/src/lib/router';

function RouteProbe(): React.JSX.Element {
  const { investorId } = useParams<{ investorId?: string }>();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  return (
    <div>
      <output aria-label="route state">
        {investorId}|{searchParams.get('list')}|{location.hash}
      </output>
      <button
        onClick={() => {
          const next = new URLSearchParams(searchParams);
          next.delete('list');
          setSearchParams(next, { replace: true });
        }}
      >
        Clear query
      </button>
    </div>
  );
}

function NavigationProbe(): React.JSX.Element {
  const navigate = useNavigate();
  return (
    <>
      <NavLink to="/" end>
        Home
      </NavLink>
      <NavLink to="/settings">Settings</NavLink>
      <button onClick={() => navigate('/settings/connectors')}>Open connectors</button>
    </>
  );
}

describe('local hash router', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '#/');
  });

  it('decodes route parameters and preserves query and in-page anchors', () => {
    window.history.replaceState({}, '', '#/investors/person%3Aada?list=focus%3Aai#portfolio');
    render(
      <HashRouter>
        <Routes>
          <Route path="/investors/:investorId" element={<RouteProbe />} />
        </Routes>
      </HashRouter>,
    );

    expect(screen.getByLabelText('route state')).toHaveTextContent(
      'person:ada|focus:ai|#portfolio',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Clear query' }));
    expect(window.location.hash).toBe('#/investors/person%3Aada#portfolio');
    expect(screen.getByLabelText('route state')).toHaveTextContent('person:ada||#portfolio');
  });

  it('navigates locally and computes exact and prefix active links', () => {
    render(
      <HashRouter>
        <NavigationProbe />
      </HashRouter>,
    );

    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Settings' })).not.toHaveAttribute('aria-current');
    fireEvent.click(screen.getByRole('button', { name: 'Open connectors' }));
    expect(window.location.hash).toBe('#/settings/connectors');
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current');
  });
});
