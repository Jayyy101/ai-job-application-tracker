export const STATUSES = ["Interested", "Applied", "Interviewing", "Offer", "Rejected", "Withdrawn"] as const;
export type ApplicationStatus = typeof STATUSES[number];

export type ApplicationFields = {
  company: string;
  role: string;
  status: ApplicationStatus;
  job_link: string | null;
  job_description: string | null;
  notes: string | null;
  next_action: string | null;
  follow_up_date: string | null;
};

export type Application = ApplicationFields & {
  id: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};
