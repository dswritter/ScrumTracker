import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface AuthState {
  currentUserId: string | null
  /** When an upper-management user is "inside" a team, this holds the viewed teamId. */
  viewingTeamId: string | null
  setCurrentUserId: (id: string | null) => void
  setViewingTeamId: (id: string | null) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      currentUserId: null,
      viewingTeamId: null,
      setCurrentUserId: (id) => set({ currentUserId: id, viewingTeamId: null }),
      setViewingTeamId: (id) => set({ viewingTeamId: id }),
    }),
    {
      name: 'scrum-tracker-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        currentUserId: s.currentUserId,
        viewingTeamId: s.viewingTeamId,
      }),
    },
  ),
)
