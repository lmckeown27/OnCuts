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
  async submit(form: BarberApplicationForm): Promise<SubmitApplicationResponse> {
    return api.post<SubmitApplicationResponse>('/barber-applications', form);
  }

  /**
   * Get current user's application status
   */
  async getMyApplication(): Promise<MyApplicationResponse> {
    return api.get<MyApplicationResponse>('/barber-applications/my-application');
  }
}

export const barberApplicationService = new BarberApplicationService();
export default barberApplicationService;

