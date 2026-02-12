// Re-export everything from the configurable subjects config
export * from '../config/subjects.config';

// Explicitly import for backward compatibility
import { ALL_SUBJECTS } from '../config/subjects.config';

// Legacy exports for backward compatibility (will be removed in future)
export const PREDEFINED_SUBJECTS = ALL_SUBJECTS.filter((s: any) => s.semester === 1 || !s.semester);
