import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface AuthState {
  currentUserId: string | null
  setCurrentUserId: (id: string | null) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      currentUserId: null,
      setCurrentUserId: (id) => set({ currentUserId: id }),
    }),
    {
      name: 'scrum-tracker-auth',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (s) => ({ currentUserId: s.currentUserId }),
    },
  ),
)
