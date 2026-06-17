import { Brain } from "lucide-react";

export function ResearchPlan({ plan, actions, advice }) {
  if (!plan && !actions.length && !advice) return null;

  return (
    <section className="section-block" aria-label="Research plan and advice">
      <div className="section-heading">
        <span>2</span>
        <div>
          <h2>Research plan</h2>
          <p>Use this as a starting point for hypothesis design and study setup.</p>
        </div>
      </div>

      {advice && (
        <div className="advice-grid">
          <AdviceCard title="Hypothesis" items={advice.hypotheses} />
          <AdviceCard title="Study design" items={advice.studyDesign} />
          <AdviceCard title="Experiment steps" items={advice.experimentSteps} />
          <AdviceCard title="Variables" items={advice.variables} />
          <AdviceCard title="Risks" items={advice.cautions} />
        </div>
      )}

      {plan && (
        <div className="plan-panel">
          <div className="mini-heading">
            <Brain size={18} aria-hidden="true" />
            <h3>{plan.intent}</h3>
          </div>
          <div className="query-list">
            {(plan.queries || []).map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </div>
      )}

      {actions.length > 0 && (
        <details className="action-details">
          <summary>Browsing actions ({actions.length})</summary>
          <div className="action-log">
            {actions.map((action, index) => (
              <div className="action-row" key={`${action.target}-${action.query || action.note}-${index}`}>
                <span className={`action-state ${action.status}`}>{action.status}</span>
                <div>
                  <strong>{action.target}</strong>
                  <p>
                    {action.query ? `${action.query} - ` : ""}
                    {action.note}
                  </p>
                </div>
                <span className="action-count">{action.found}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}

function AdviceCard({ title, items }) {
  if (!items?.length) return null;

  return (
    <article className="advice-card">
      <h3>{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </article>
  );
}
