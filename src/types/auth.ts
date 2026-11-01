import type { Session, User } from '@supabase/supabase-js';

import type { UserRole } from './database';

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

export interface AuthProfile {
  id: string;
  full_name: string;
  role: UserRole;
}

export interface SignUpParams {
  email: string;
  password: string;
  fullName: string;
  role: UserRole;
}

export interface SignInParams {
  email: string;
  password: string;
}

export interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: AuthProfile | null;
  role: UserRole | null;
  status: AuthStatus;
  signIn: (params: SignInParams) => Promise<{ user: User; session: Session }>;
  signUp: (params: SignUpParams) => Promise<{ user: User | null; session: Session | null }>;
  signOut: () => Promise<void>;
}

