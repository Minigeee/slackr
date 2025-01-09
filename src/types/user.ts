export type UserStatus = 'invisible' | 'away' | 'busy' | 'online' | 'offline';

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  profilePicture: string;
  status: UserStatus;
  statusMessage?: string | null;
  lastSeen: Date;
}
