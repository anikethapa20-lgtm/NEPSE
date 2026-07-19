export type SectionStatus = "not_started" | "drafting" | "review" | "complete";

export type PaperSection = {
  id: string;
  project_id: string;
  title: string;
  content: string;
  status: SectionStatus;
  sort_order: number;
  updated_at: string;
};

export type ResearchNote = {
  id: string;
  project_id: string;
  title: string;
  body: string;
  note_type: "analysis" | "methodology" | "literature" | "question";
  created_at: string;
};

export type Decision = {
  id: string;
  project_id: string;
  title: string;
  decision: string;
  rationale: string;
  status: "open" | "decided" | "revisit";
  created_at: string;
};

export type ResearchFile = {
  id: string;
  project_id: string;
  file_name: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  category: "dataset" | "figure" | "paper" | "code" | "output" | "other";
  description: string | null;
  uploaded_at: string;
};

export type ProjectMetric = {
  id: string;
  project_id: string;
  metric_key: string;
  metric_label: string;
  metric_value: number;
  metric_unit: string | null;
  metric_group: string;
  sort_order: number;
};


export type ResearchEvent = {
  id: number;
  project_id: string;
  symbol: string;
  event_date: string;
  close_price: number | null;
  volume: number | null;
  abnormal_return: number | null;
  volume_multiple: number | null;
  return_sigma: number | null;
  severity_score: number | null;
  event_year: number | null;
  classification: string;
  review_status: string;
  announcement_match: string | null;
  insider_score: number | null;
  pump_score: number | null;
  reviewer_notes: string | null;
  auto_classification?: string | null;
  confidence_score?: number | null;
  explanation_status?: string | null;
  matched_disclosure_count?: number | null;
  matched_pump_cycle_count?: number | null;
  pre_car_5?: number | null;
  post_car_5?: number | null;
  cross_reference_summary?: string | null;
};

export type DataQualityIssue = {
  id: string;
  project_id: string;
  issue_type: string;
  symbol: string | null;
  issue_date: string | null;
  severity: string;
  title: string;
  description: string;
  possible_cause: string | null;
  resolution: string | null;
  status: string;
};
