import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { userService } from '@/app/services/user.service';

/**
 * Custom hook for authentication
 * Automatically fetches user and redirects to login or invite-verify if needed
 * @returns [user, setUser] tuple - user object (or null) and setter function
 */
export function useAuth(): [any, (user: any) => void] {
  const [user, setUser] = useState<any>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    userService.get().then(u => {
      if (!u) {
        router.push('/login');
      } else {
        // // Check if user has access (accepted OR premium OR paid)
        // const hasAccess = userService.checkUserAccess(u);

        // // Don't redirect if already on invite-verify page (to avoid infinite loop)
        // if (!hasAccess && pathname !== '/invite-verify') {
        //   // User doesn't have access - redirect to invite request page
        //   router.push('/invite-verify');
        // } else {
        //   setUser(u);
        // }
        setUser(u);
      }
    }).catch(error => {
      console.error('useAuth: Error fetching user:', error);
      router.push('/login');
    });
  }, [router, pathname]);

  return [user, setUser];
}
