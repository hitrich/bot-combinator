import {
  Children,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type AnchorHTMLAttributes,
  type MouseEvent,
  type PropsWithChildren,
  type ReactElement,
  type ReactNode,
} from 'react';

interface LocationValue {
  pathname: string;
  search: string;
  hash: string;
}

interface NavigateOptions {
  replace?: boolean;
}

type NavigateFunction = (destination: string, options?: NavigateOptions) => void;

interface RouterValue {
  location: LocationValue;
  navigate: NavigateFunction;
}

const RouterContext = createContext<RouterValue | null>(null);
const ParamsContext = createContext<Record<string, string>>({});

function parseHash(): LocationValue {
  const rawHash = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : window.location.hash;
  const localDestination = rawHash.startsWith('/') && !rawHash.startsWith('//') ? rawHash : '/';
  const parsed = new URL(localDestination, 'https://bot-combinator.local');
  return {
    pathname: parsed.pathname || '/',
    search: parsed.search,
    hash: parsed.hash,
  };
}

function normalizeDestination(destination: string): string {
  const value = destination.trim();
  if (!value.startsWith('/') || value.startsWith('//')) {
    throw new Error('Bot Combinator navigation only accepts local application paths.');
  }
  return value;
}

export function HashRouter({ children }: PropsWithChildren): React.JSX.Element {
  const [location, setLocation] = useState<LocationValue>(parseHash);

  useEffect(() => {
    const onHashChange = (): void => setLocation(parseHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = useCallback<NavigateFunction>((destination, options) => {
    const next = normalizeDestination(destination);
    const nextHash = `#${next}`;
    if (options?.replace) {
      window.history.replaceState(window.history.state, '', nextHash);
      setLocation(parseHash());
      return;
    }
    if (window.location.hash === nextHash) {
      setLocation(parseHash());
      return;
    }
    window.location.hash = next;
    setLocation(parseHash());
  }, []);

  const value = useMemo(() => ({ location, navigate }), [location, navigate]);
  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

function useRouter(): RouterValue {
  const value = useContext(RouterContext);
  if (!value) throw new Error('Router hooks must be used inside HashRouter.');
  return value;
}

export function useNavigate(): NavigateFunction {
  return useRouter().navigate;
}

export function useLocation(): LocationValue {
  return useRouter().location;
}

export function useParams<
  T extends Record<string, string | undefined> = Record<string, string | undefined>,
>(): T {
  return useContext(ParamsContext) as T;
}

type SearchParamsSetter = (next: URLSearchParams, options?: NavigateOptions) => void;

export function useSearchParams(): [URLSearchParams, SearchParamsSetter] {
  const { location, navigate } = useRouter();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const setParams = useCallback<SearchParamsSetter>(
    (next, options) => {
      const query = next.toString();
      navigate(`${location.pathname}${query ? `?${query}` : ''}${location.hash}`, options);
    },
    [location.hash, location.pathname, navigate],
  );
  return [params, setParams];
}

interface RouteProps {
  path: string;
  element: ReactNode;
}

export function Route(_props: RouteProps): null {
  void _props;
  return null;
}

function decodeSegment(segment: string): string | null {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

function matchRoute(pattern: string, pathname: string): Record<string, string> | null {
  if (pattern === '*') return {};
  const patternSegments = pattern.split('/').filter(Boolean);
  const pathSegments = pathname.split('/').filter(Boolean);
  const wildcard = patternSegments.at(-1) === '*';
  if (
    (!wildcard && patternSegments.length !== pathSegments.length) ||
    (wildcard && pathSegments.length < patternSegments.length - 1)
  ) {
    return null;
  }

  const params: Record<string, string> = {};
  for (let index = 0; index < patternSegments.length; index += 1) {
    const expected = patternSegments[index];
    if (expected === '*') return params;
    const actual = pathSegments[index];
    if (!actual) return null;
    if (expected?.startsWith(':')) {
      const decoded = decodeSegment(actual);
      if (decoded === null) return null;
      params[expected.slice(1)] = decoded;
    } else if (expected !== actual) {
      return null;
    }
  }
  return params;
}

export function Routes({ children }: PropsWithChildren): React.JSX.Element | null {
  const { pathname } = useLocation();
  for (const child of Children.toArray(children)) {
    if (!isValidElement<RouteProps>(child) || child.type !== Route) continue;
    const params = matchRoute(child.props.path, pathname);
    if (params !== null) {
      return <ParamsContext.Provider value={params}>{child.props.element}</ParamsContext.Provider>;
    }
  }
  return null;
}

interface NavigateProps extends NavigateOptions {
  to: string;
}

export function Navigate({ to, replace }: NavigateProps): null {
  const navigate = useNavigate();
  useEffect(
    () => navigate(to, replace === undefined ? undefined : { replace }),
    [navigate, replace, to],
  );
  return null;
}

interface NavLinkState {
  isActive: boolean;
}

interface NavLinkProps extends Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  'children' | 'className' | 'href'
> {
  to: string;
  end?: boolean;
  className?: string | ((state: NavLinkState) => string);
  children?: ReactNode | ((state: NavLinkState) => ReactNode);
}

export function NavLink({
  to,
  end = false,
  className,
  children,
  onClick,
  ...rest
}: NavLinkProps): ReactElement {
  const { location, navigate } = useRouter();
  const target = new URL(normalizeDestination(to), 'https://bot-combinator.local');
  const isActive = end
    ? location.pathname === target.pathname
    : location.pathname === target.pathname || location.pathname.startsWith(`${target.pathname}/`);
  const state = { isActive };
  const handleClick = (event: MouseEvent<HTMLAnchorElement>): void => {
    onClick?.(event);
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    event.preventDefault();
    navigate(to);
  };

  return (
    <a
      {...rest}
      href={`#${to}`}
      className={typeof className === 'function' ? className(state) : className}
      aria-current={isActive ? 'page' : undefined}
      onClick={handleClick}
    >
      {typeof children === 'function' ? children(state) : children}
    </a>
  );
}
