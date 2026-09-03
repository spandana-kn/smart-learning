import api from './api'
import type { User } from '@/types'

export interface LoginPayload { email: string; password: string }
export interface RegisterPayload { email: string; password: string; full_name: string; role: 'student' | 'teacher' }
export interface AuthResponse { access_token: string; user: User }

export const authService = {
  login: (payload: LoginPayload) =>
    api.post<AuthResponse>('/auth/login', payload).then((r) => r.data),

  register: (payload: RegisterPayload) =>
    api.post<AuthResponse>('/auth/register', payload).then((r) => r.data),

  me: () =>
    api.get<User>('/users/me').then((r) => r.data),
}
