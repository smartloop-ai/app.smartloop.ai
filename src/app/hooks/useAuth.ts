import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { userService } from '@/app/services/user.service';

/** The user saved by the last successful /users/me, or null. */
function cachedUser(): any {
  try {
    const saved = localStorage.getItem('u');
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

/**
 * The signed-in user, loaded once when the component using it mounts.
 *
 * A layout keeps its hooks while you move between its child routes, so the
 * user is not fetched again on every page change. Refetching gave the page a
 * new user object each time, and everything keyed on the user loaded again.
 *
 * No session (no token, or a 401) sends you to /login. A server or network
 * error does not: the session is still good, so the page carries on with the
 * user saved by the last successful load, and its own requests report errors.
 *
 * @returns [user, setUser] tuple - user object (or null) and setter function
 */
export function useAuth(): [any, (user: any) => void] {
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    userService.get().then(u => {
      if (!u) {
        router.push('/login');
      } else {
        setUser(u);
      }
    }).catch(error => {
      console.error('useAuth: Error fetching user:', error);
      const saved = cachedUser();
      if (saved) {
        setUser(saved);
      } else {
        router.push('/login');
      }
    });
  }, [router]);

  return [user, setUser];
}
