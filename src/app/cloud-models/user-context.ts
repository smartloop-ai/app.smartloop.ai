'use client';

/**
 * The signed-in user, provided by the Cloud Models layout. The layout owns the
 * auth check so it runs once for the section, not again on every page.
 */

import { createContext, useContext } from 'react';

/** null until /users/me has answered. */
export const CloudUserContext = createContext<any>(null);

export const useCloudUser = () => useContext(CloudUserContext);
