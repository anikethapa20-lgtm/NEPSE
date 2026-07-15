import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { Download, File, FileArchive, FileCode2, FileImage, FileSpreadsheet, Trash2, UploadCloud } from "lucide-react";
import { supabase } from "../lib/supabase";
import type { ResearchFile } from "../types";

type Props = {
  projectId: string;
};

const MAX_FILE_SIZE = 100 * 1024 * 1024;

export default function FilesPanel({ projectId }: Props) {
  const [files, setFiles] = useState<ResearchFile[]>([]);
  const [selected, setSelected] = useState<FileList | null>(null);
  const [category, setCategory] = useState<ResearchFile["category"]>("dataset");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [filter, setFilter] = useState("all");

  async function loadFiles() {
    const { data, error } = await supabase
      .from("research_files")
      .select("*")
      .eq("project_id", projectId)
      .order("uploaded_at", { ascending: false });

    if (error) setMessage(error.message);
    setFiles((data || []) as ResearchFile[]);
  }

  useEffect(() => { loadFiles(); }, [projectId]);

  function chooseFiles(event: ChangeEvent<HTMLInputElement>) {
    setSelected(event.target.files);
    setMessage("");
  }

  async function upload(event: FormEvent) {
    event.preventDefault();
    if (!selected?.length) {
      setMessage("Select at least one file.");
      return;
    }

    setUploading(true);
    setMessage("");

    for (const file of Array.from(selected)) {
      if (file.size > MAX_FILE_SIZE) {
        setMessage(`${file.name} is larger than 100 MB. Upload it in smaller parts.`);
        setUploading(false);
        return;
      }

      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${projectId}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;

      const storageResult = await supabase.storage
        .from("research-files")
        .upload(path, file, { upsert: false, contentType: file.type || undefined });

      if (storageResult.error) {
        setMessage(storageResult.error.message);
        setUploading(false);
        return;
      }

      const metadataResult = await supabase.from("research_files").insert({
        project_id: projectId,
        file_name: file.name,
        storage_path: path,
        mime_type: file.type || null,
        size_bytes: file.size,
        category,
        description: description.trim() || null,
      });

      if (metadataResult.error) {
        await supabase.storage.from("research-files").remove([path]);
        setMessage(metadataResult.error.message);
        setUploading(false);
        return;
      }
    }

    setUploading(false);
    setSelected(null);
    setDescription("");
    setMessage("Upload completed.");
    const input = document.getElementById("research-file-input") as HTMLInputElement | null;
    if (input) input.value = "";
    await loadFiles();
  }

  async function download(file: ResearchFile) {
    const { data, error } = await supabase.storage.from("research-files").createSignedUrl(file.storage_path, 60);
    if (error) {
      setMessage(error.message);
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function remove(file: ResearchFile) {
    if (!window.confirm(`Delete ${file.file_name}?`)) return;
    const storageResult = await supabase.storage.from("research-files").remove([file.storage_path]);
    if (storageResult.error) {
      setMessage(storageResult.error.message);
      return;
    }
    const { error } = await supabase.from("research_files").delete().eq("id", file.id);
    if (error) setMessage(error.message);
    await loadFiles();
  }

  const visible = useMemo(
    () => filter === "all" ? files : files.filter((file) => file.category === filter),
    [files, filter]
  );

  const totalBytes = files.reduce((sum, file) => sum + (file.size_bytes || 0), 0);

  return (
    <section className="files-page">
      <div className="panel-heading">
        <div>
          <div className="eyebrow">RESEARCH LIBRARY</div>
          <h2>Datasets, Code, Papers and Outputs</h2>
          <p>{files.length} files · {formatBytes(totalBytes)} stored</p>
        </div>
      </div>

      <form className="upload-card" onSubmit={upload}>
        <div className="upload-drop">
          <UploadCloud size={34} />
          <div>
            <strong>Upload existing research files</strong>
            <span>CSV, Excel, Stata, R, Python, PDF, images, ZIP files and other supporting material</span>
          </div>
          <input id="research-file-input" type="file" multiple onChange={chooseFiles} />
        </div>

        <div className="upload-controls">
          <select value={category} onChange={(e) => setCategory(e.target.value as ResearchFile["category"])}>
            <option value="dataset">Dataset</option>
            <option value="figure">Figure or chart</option>
            <option value="paper">Paper or source</option>
            <option value="code">Code</option>
            <option value="output">Analysis output</option>
            <option value="other">Other</option>
          </select>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description applied to this upload"
          />
          <button type="submit" disabled={uploading}>
            <UploadCloud size={17} /> {uploading ? "Uploading..." : "Upload"}
          </button>
        </div>

        {selected?.length ? (
          <div className="selected-files">{Array.from(selected).map((f) => f.name).join(", ")}</div>
        ) : null}
        {message && <div className="notice">{message}</div>}
      </form>

      <div className="file-toolbar">
        <strong>Project files</strong>
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">All categories</option>
          <option value="dataset">Datasets</option>
          <option value="figure">Figures</option>
          <option value="paper">Papers</option>
          <option value="code">Code</option>
          <option value="output">Outputs</option>
          <option value="other">Other</option>
        </select>
      </div>

      <div className="file-table">
        {visible.length === 0 && <div className="empty-state">No files have been uploaded in this category.</div>}
        {visible.map((file) => (
          <article className="file-row" key={file.id}>
            <div className="file-type-icon">{iconFor(file)}</div>
            <div className="file-info">
              <strong>{file.file_name}</strong>
              <span>{file.category} · {formatBytes(file.size_bytes || 0)} · {new Date(file.uploaded_at).toLocaleString()}</span>
              {file.description && <p>{file.description}</p>}
            </div>
            <div className="file-actions">
              <button onClick={() => download(file)} title="Download"><Download size={17} /></button>
              <button onClick={() => remove(file)} title="Delete"><Trash2 size={17} /></button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function iconFor(file: ResearchFile) {
  const name = file.file_name.toLowerCase();
  if (/\.(csv|xlsx?|dta|sav|parquet)$/.test(name)) return <FileSpreadsheet size={22} />;
  if (/\.(png|jpe?g|svg|webp)$/.test(name)) return <FileImage size={22} />;
  if (/\.(py|r|rmd|do|ipynb|sql|js|ts)$/.test(name)) return <FileCode2 size={22} />;
  if (/\.(zip|rar|7z|tar|gz)$/.test(name)) return <FileArchive size={22} />;
  return <File size={22} />;
}

function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, index)).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}
