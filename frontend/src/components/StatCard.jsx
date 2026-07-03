const StatCard = ({ label, value, detail }) => (
  <article className="stat-card">
    <span>{label}</span>
    <strong>{value}</strong>
    {detail ? <small>{detail}</small> : null}
  </article>
);

export default StatCard;
