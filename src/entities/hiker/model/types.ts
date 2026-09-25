import type { Member, MemberStatus, LocationUpdate, PrivacyMode } from '@/core/domain/types';

export type Hiker = Member & {
  privacyMode?: PrivacyMode;
  isVerified?: boolean;
  keyFingerprint?: string;
};

