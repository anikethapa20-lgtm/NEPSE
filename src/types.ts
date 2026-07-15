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
