import axios from 'axios';
import { API_BASE_URL, STORAGE_KEYS } from '../config/constants';

export interface PathBPayoutStatus {
  payout_ready: boolean;
  sui_address: string | null;
  invalid_stored_address: boolean;
  stored_address_preview: string | null;
}

function authHeader() {
  return { Authorization: `Bearer ${localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN) || ''}` };
}

export async function fetchPathBPayoutStatus(): Promise<PathBPayoutStatus> {
  const res = await axios.get<{ success: boolean; data: PathBPayoutStatus }>(
    `${API_BASE_URL}/barber/path-b/payout-status`,
    { headers: authHeader() }
  );
  return res.data.data;
}
