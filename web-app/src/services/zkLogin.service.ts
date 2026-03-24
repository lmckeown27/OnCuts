import axios from 'axios';
import { getBackendOrigin, STORAGE_KEYS } from '../config/constants';

/**
 * zkLogin orchestration: fetch salt from backend, then complete flow with @mysten/sui/zklogin in UI code.
 * Wire Google OAuth + ephemeral keys per Mysten docs; this module only handles HTTP to CampusCuts API.
 */
export async function fetchZkLoginSalt(iss: string, sub: string): Promise<string> {
  const origin = getBackendOrigin();
  const res = await axios.post<{ salt: string }>(`${origin}/api/zklogin/salt`, { iss, sub });
  return res.data.salt;
}

export async function persistUserSuiAddress(suiAddress: string, zkLoginSalt?: string): Promise<void> {
  const origin = getBackendOrigin();
  await axios.put(
    `${origin}/api/zklogin/address`,
    { suiAddress, zkLoginSalt },
    {
      headers: {
        Authorization: `Bearer ${localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN) || ''}`,
      },
    }
  );
}
