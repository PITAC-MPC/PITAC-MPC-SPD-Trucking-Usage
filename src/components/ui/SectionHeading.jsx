/** Eyebrow + title + description, with an optional action on the right. */
export default function SectionHeading({ eyebrow, title, description, action }) {
  return (
    <div className="section-heading">
      <div>
        <div className="section-eyebrow">{eyebrow}</div>
        <h2 className="section-title">{title}</h2>
        {description && (
          <p className="section-description">{description}</p>
        )}
      </div>
      {action && <div className="section-action">{action}</div>}
    </div>
  )
}
