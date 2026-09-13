import { getSkin, isSkinId, type SkinId } from './skins';

export const PROFILE_KEY = 'pats-bar.profile.v1';
export interface ProfileData { version: 1; tokens: number; ownedSkins: SkinId[]; equippedSkin: SkinId }
export interface ProfileStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }
const initialProfile = (): ProfileData => ({ version: 1, tokens: 0, ownedSkins: ['classic'], equippedSkin: 'classic' });

export function parseProfile(raw: string | null): ProfileData {
  try {
    const value = JSON.parse(raw ?? 'null');
    if (!value || value.version !== 1) return initialProfile();
    const tokens = Number.isSafeInteger(value.tokens) && value.tokens >= 0 ? value.tokens : 0;
    const ownedSkins: SkinId[] = [...new Set<SkinId>(['classic', ...(Array.isArray(value.ownedSkins) ? value.ownedSkins.filter(isSkinId) : [])])];
    const equippedSkin = isSkinId(value.equippedSkin) && ownedSkins.includes(value.equippedSkin) ? value.equippedSkin : 'classic';
    return { version: 1, tokens, ownedSkins, equippedSkin };
  } catch { return initialProfile(); }
}

// Persistent cosmetics are deliberately independent of the resettable combat state.
export class Profile {
  private data = initialProfile();
  private storageFailed = false;
  revision = 0;
  constructor(private storage?: ProfileStorage) { this.refresh(); }
  get tokens() { return this.data.tokens; }
  get equippedSkin() { return this.data.equippedSkin; }
  get persistent() { return !!this.storage && !this.storageFailed; }
  owns(id: SkinId) { return this.data.ownedSkins.includes(id); }
  refresh() {
    if (!this.storage || this.storageFailed) return;
    try {
      const next = parseProfile(this.storage.getItem(PROFILE_KEY));
      if (JSON.stringify(next) !== JSON.stringify(this.data)) { this.data = next; this.revision++; }
    } catch { this.storageFailed = true; this.revision++; }
  }
  private save() {
    try { if (this.storage) { this.storage.setItem(PROFILE_KEY, JSON.stringify(this.data)); this.storageFailed = false; } }
    catch { this.storageFailed = true; }
    this.revision++;
  }
  awardBossToken() {
    this.refresh();
    if (this.data.tokens >= Number.MAX_SAFE_INTEGER) return;
    this.data.tokens++; this.save();
  }
  buy(id: SkinId) {
    this.refresh();
    if (!isSkinId(id) || this.owns(id) || this.data.tokens < getSkin(id).price) return false;
    this.data = { ...this.data, tokens: this.data.tokens - getSkin(id).price, ownedSkins: [...this.data.ownedSkins, id], equippedSkin: id };
    this.save(); return true;
  }
  equip(id: SkinId) {
    this.refresh();
    if (!this.owns(id)) return false;
    if (id !== this.data.equippedSkin) { this.data.equippedSkin = id; this.save(); }
    return true;
  }
}

export function createBrowserProfile() {
  try { return new Profile(window.localStorage); }
  catch { return new Profile(); }
}
