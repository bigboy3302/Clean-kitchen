export interface UserProfile {
  id: string;
  displayName: string;
  email: string;
  avatarUrl?: string;
  householdId?: string;
}

export interface PantryItem {
  id: string;
  userId?: string;
  householdId?: string;
  name: string;
  category?: string;
  quantity: { amount: number; unit: string };
  expiryDate?: string;  
  addedAt: string;      
  photoUrl?: string;
  barcode?: string;
  confidence?: number;
  notes?: string;
}
