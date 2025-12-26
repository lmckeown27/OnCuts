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
  status: 'pending' | 'under_review' | 'interview_scheduled' | 'approved' | 'rejected';
  years_experience: string;
  specialties: string[];
  available_hours: string;
  created_at: string;
  reviewed_at?: string;
  interview_scheduled_at?: string;
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
}

export const barberApplicationService = new BarberApplicationService();
export default barberApplicationService;

