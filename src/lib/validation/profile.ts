import { z } from 'zod';

export const ProfileSchema = z.object({
  fullName: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters')
    .regex(/^[\p{L}\s'-]+$/u, 'Name contains invalid characters'),

  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be less than 30 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),

  website: z.string()
    .max(200, 'Website URL too long')
    .refine((val) => {
      if (!val) return true;
      try {
        const url = new URL(val);
        return url.protocol === 'http:' || url.protocol === 'https:';
      } catch {
        return false;
      }
    }, 'Website must be a valid HTTP/HTTPS URL'),

  avatarUrl: z.string()
    .max(500, 'Avatar URL too long')
    .refine((val) => {
      if (!val) return true;
      try {
        const url = new URL(val);
        return url.protocol === 'http:' || url.protocol === 'https:';
      } catch {
        return false;
      }
    }, 'Avatar URL must be a valid HTTP/HTTPS URL'),
});

export type ProfileUpdateInput = z.infer<typeof ProfileSchema>;
