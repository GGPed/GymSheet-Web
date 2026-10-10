import { createContext, useContext, type ReactNode } from 'react'

export const RecoveryWorkoutLock = createContext(false)

/** Native fieldsets lock operations while leaving surrounding consultation available. */
export function WorkoutControls({ children, className = '' }: { children: ReactNode; className?: string }) {
  const locked = useContext(RecoveryWorkoutLock)
  return <fieldset className={`workout-controls ${className}`} disabled={locked} aria-disabled={locked}>{children}</fieldset>
}
