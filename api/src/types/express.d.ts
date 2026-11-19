import 'express';

declare global {
  namespace Express {
    interface User {
      googleSub: string;
      email: string;
      displayName: string;
      avatarUrl: string | null;
    }
  }
}
