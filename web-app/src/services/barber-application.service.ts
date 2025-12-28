import api from './api.service';

export interface BarberApplicationForm {
  yearsExperience: string;
  hasLicense: boolean;
  licenseNumber?: string;
  specialties: string[];
  hasOwnTools: boolean;
  availableHours: string;
  whyBeBarber: string;
  portfolioDescription?: string;
  socialMedia?: string;
  additionalNotes?: string;
}

export interface BarberApplication {
  id: string;
  user_id: string;
  status: 'pending' | 'under_review' | 'interview_scheduled' | 'approved' | 'rejected';
  years_experience: number;
  has_license: boolean;
  license_number?: string;
  specialties: string[];
  has_own_tools: boolean;
  available_hours: string;
  why_be_barber: string;
  portfolio_description?: string;
  social_media?: string;
  additional_notes?: string;
  created_at: string;
  updated_at: string;
  reviewed_at?: string;
  interview_scheduled_at?: string;
  user?: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    profile_picture_url?: string;
  };
}

export interface SubmitApplicationResponse {
  success: boolean;
  message: string;
  data: {
    applicationId: string;
    status: string;
    submittedAt: string;
  };
}

export interface MyApplicationResponse {
  success: boolean;
  data: BarberApplication | null;
  message?: string;
}

class BarberApplicationService {
  /**
   * Submit a new barber application
   */
  async submit(form: BarberApplicationForm): Promise<{ applicationId: string; status: string; submittedAt: string }> {
    // api.post extracts response.data.data, so we get the inner data object directly
    return api.post<{ applicationId: string; status: string; submittedAt: string }>('/barber-applications', form);
  }

  /**
   * Get current user's application status
   */
  async getMyApplication(): Promise<BarberApplication | null> {
    // api.get extracts response.data.data
    return api.get<BarberApplication | null>('/barber-applications/my-application');
  }

  /**
   * Get all barber applications (admin/campus manager only)
   */
  async getAllApplications(): Promise<{ data: BarberApplication[] }> {
    const response = await api.get<BarberApplication[]>('/barber-applications');
    return { data: response || [] };
  }

  /**
   * Update application status (admin/campus manager only)
   */
  async updateApplicationStatus(
    applicationId: string, 
    status: 'approved' | 'rejected' | 'interview_scheduled'
  ): Promise<void> {
    await api.put(`/barber-applications/${applicationId}/status`, { status });
  }
}

export const barberApplicationService = new BarberApplicationService();
export default barberApplicationService;

