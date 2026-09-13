export type SkinId = 'classic' | 'blue' | 'purple' | 'black' | 'gold' | 'tshirt';
export interface Skin { id: SkinId; name: string; price: number; description: string; asset: string; hoodieColor?: string }
const hoodie = '/assets/hero-key.png';
export const SKINS: readonly Skin[] = [
  { id: 'classic', name: 'Classic Owen', price: 0, description: 'The original red hoodie. Always yours.', asset: hoodie },
  { id: 'blue', name: 'Blue Hoodie', price: 30, description: 'A cool blue take on your usual look.', asset: hoodie, hoodieColor: '#426cdb' },
  { id: 'purple', name: 'Purple Hoodie', price: 30, description: 'A little purple for a long night.', asset: hoodie, hoodieColor: '#9651c6' },
  { id: 'black', name: 'Black Hoodie', price: 30, description: 'Keep it classic in charcoal black.', asset: hoodie, hoodieColor: '#343940' },
  { id: 'gold', name: 'Gold Hoodie', price: 30, description: 'Dress like the house champion.', asset: hoodie, hoodieColor: '#d4a63a' },
  { id: 'tshirt', name: 'T-Shirt Owen', price: 50, description: 'Graphic tee, tattoos, and a new look for last call.', asset: '/assets/tshirt-owen-key.png' },
];
export const isSkinId = (id: unknown): id is SkinId => SKINS.some(skin => skin.id === id);
export const getSkin = (id: SkinId) => SKINS.find(skin => skin.id === id)!;
