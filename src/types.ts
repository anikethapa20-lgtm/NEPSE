export type PaperSection = {
  id: string;
  project_id: string;
  title: string;
  content: string;
  status: "not_started" | "drafting" | "review" | "complete";
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
