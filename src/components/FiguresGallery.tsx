import { useState } from "react";
import { AlertTriangle, ExternalLink, Image as ImageIcon } from "lucide-react";

const figures = [
  {
    file: "abnormal-return-distribution.png",
    title: "Distribution of Abnormal Returns",
    section: "Data diagnostics",
    interpretation:
      "Abnormal returns are concentrated around zero with pronounced tails. The trimmed display helps show the central distribution, but the final paper should report the trimming rule and tail observations separately."
  },
  {
    file: "average-pre-event-abnormal-return.png",
    title: "Average Pre-Event Abnormal Return Pattern",
    section: "Pre-event evidence",
    interpretation:
      "Average abnormal returns are negative from days -5 through -2 and turn strongly positive on day -1. This suggests the five-day CAR result may be driven heavily by the final pre-event day."
  },
  {
    file: "car-event-window.png",
    title: "CAR Around Suspicious Events",
    section: "Event study",
    interpretation:
      "Cumulative abnormal returns build gradually before the event, jump sharply at day 0, peak shortly afterward, and then partially reverse."
  },
  {
    file: "most-suspicious-stocks.png",
    title: "Most Suspicious Stocks in NEPSE",
    section: "Stock concentration",
    interpretation:
      "RSDC, SHL, and UNL have the largest number of detected events in the current output. These counts should be normalized by each stock's trading history before ranking risk."
  },
  {
    file: "corbl-abnormal-returns.png",
    title: "CORBL Abnormal Returns",
    section: "Data quality review",
    interpretation:
      "The extreme negative observation around 2022 may reflect a corporate action, data error, or unadjusted price discontinuity. It should be investigated before final estimation."
  },
  {
    file: "car-short-window.png",
    title: "Short-Window Cumulative Abnormal Return",
    section: "Event study",
    interpretation:
      "The shorter event window confirms strong accumulation into day 0 and a gradual decline after the event."
  },
  {
    file: "average-abnormal-returns.png",
    title: "Average Abnormal Returns Around Events",
    section: "Event study",
    interpretation:
      "Day 0 contains the dominant average abnormal return. Because the event definition includes an extreme-return condition, the day-0 spike is expected by construction."
  },
  {
    file: "abnormal-return-heatmap.png",
    title: "Abnormal Return Heatmap",
    section: "Event heterogeneity",
    interpretation:
      "The heatmap shows a broad positive event-day band and substantial heterogeneity before and after events. The final analysis should report how many events have positive pre-event CAR."
  },
  {
    file: "top-15-suspicious-events.png",
    title: "Top 15 Stocks by Suspicious Events",
    section: "Stock concentration",
    interpretation:
      "The ranking repeats the concentration seen in the earlier bar chart and provides a consistent list of stocks for event-level validation."
  },
  {
    file: "pump-day-abnormal-return.png",
    title: "Average Abnormal Returns Around Pump Days",
    section: "Pump-and-dump analysis",
    interpretation:
      "Returns increase before the pump day, peak sharply on day 0, and turn negative afterward. This is consistent with a run-up and reversal pattern, but classification rules must be documented."
  }
];

export default function FiguresGallery() {
  const [selected, setSelected] = useState<(typeof figures)[number] | null>(null);

  return (
    <section className="gallery-page">
      <div className="panel-heading">
        <div>
          <div className="eyebrow">VISUAL EVIDENCE</div>
          <h2>Research Figures and Current Interpretation</h2>
          <p>These figures are bundled with the website and can be used while developing the full manuscript.</p>
        </div>
        <a
          className="paper-link"
          href="/research-assets/preliminary-research-note.pdf"
          target="_blank"
          rel="noreferrer"
        >
          <ExternalLink size={16} /> Open preliminary note
        </a>
      </div>

      <div className="research-alert">
        <AlertTriangle size={20} />
        <div>
          <strong>Event count needs reconciliation</strong>
          <span>The preliminary note reports 843 events, while the current abnormal-event CSV contains 845. Keep both numbers visible until the final event-generation code is reproduced.</span>
        </div>
      </div>

      <div className="gallery-grid">
        {figures.map((figure) => (
          <article className="figure-card" key={figure.file}>
            <button onClick={() => setSelected(figure)} className="figure-image-button">
              <img src={`/research-assets/${figure.file}`} alt={figure.title} />
            </button>
            <div className="figure-card-body">
              <span>{figure.section}</span>
              <h3>{figure.title}</h3>
              <p>{figure.interpretation}</p>
            </div>
          </article>
        ))}
      </div>

      {selected && (
        <div className="image-modal" onClick={() => setSelected(null)}>
          <div className="image-modal-card" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelected(null)}>×</button>
            <img src={`/research-assets/${selected.file}`} alt={selected.title} />
            <div>
              <div className="eyebrow">{selected.section}</div>
              <h2>{selected.title}</h2>
              <p>{selected.interpretation}</p>
            </div>
          </div>
        </div>
      )}

      <div className="gallery-footnote">
        <ImageIcon size={18} />
        <span>Use the Research Files tab to upload the source datasets and future versions of these charts.</span>
      </div>
    </section>
  );
}
