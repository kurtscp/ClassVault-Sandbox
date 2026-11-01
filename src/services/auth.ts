import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';

import { toUserMessage } from '../lib/errors';
import { supabase } from '../lib/supabase';
import type { AuthProfile, SignInParams, SignUpParams } from '../types/auth';
import type { UserRole } from '../types/database';
import { AppError } from '../types/domain';

/**
 * Registers a new user with Supabase Auth.
 * Role and full name are attached to raw_user_meta_data so the handle_new_user()
 * database trigger can populate public.profiles automatically.
 */
export async function signUp({
  email,
  password,
  fullName,
  role,
}: SignUpParams): Promise<{ user: User | null; session: Session | null }> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        role,
      },
    },
  });

  if (error) {
    throw new AppError(
      error.name || 'AUTH_SIGN_UP_ERROR',
      toUserMessage(error),
      error
    );
  }

  return {
    user: data.user,
    session: data.session,
  };
}

/**
 * Signs in an existing user with email and password.
 */
export async function signIn({
  email,
  password,
}: SignInParams): Promise<{ user: User; session: Session }> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw new AppError(
      error.name || 'AUTH_SIGN_IN_ERROR',
      toUserMessage(error),
      error
    );
  }

  if (!data.user || !data.session) {
    throw new AppError(
      'AUTH_SIGN_IN_FAILED',
      toUserMessage('Sign in failed. Check your credentials and try again.')
    );
  }

  return {
    user: data.user,
    session: data.session,
  };
}

/**
 * Signs out the current user session.
 */
export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw new AppError(
      error.name || 'AUTH_SIGN_OUT_ERROR',
      toUserMessage(error),
      error
    );
  }
}

/**
 * Fetches the user profile row created by the database trigger.
 * DT-3: Selects strictly id, full_name, role.
 */
export async function getProfile(userId: string): Promise<AuthProfile> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .eq('id', userId)
    .single();

  if (error) {
    throw new AppError(
      error.code || 'PROFILE_FETCH_ERROR',
      toUserMessage(error),
      error
    );
  }

  if (!data) {
    throw new AppError(
      'PROFILE_NOT_FOUND',
      toUserMessage('Profile not found.')
    );
  }

  const role = data.role as UserRole;
  if (role !== 'instructor' && role !== 'student') {
    throw new AppError(
      'INVALID_PROFILE_ROLE',
      toUserMessage('Invalid user role assigned.')
    );
  }

  return {
    id: data.id,
    full_name: data.full_name,
    role,
  };
}

/**
 * Retrieves the persisted session on app startup without side effects.
 */
export async function getSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    throw new AppError(
      error.name || 'AUTH_GET_SESSION_ERROR',
      toUserMessage(error),
      error
    );
  }

  return data.session;
}

/**
 * Subscribes to auth state changes from Supabase client.
 */
export function onAuthStateChange(
  callback: (event: AuthChangeEvent, session: Session | null) => void
) {
  return supabase.auth.onAuthStateChange(callback);
}

