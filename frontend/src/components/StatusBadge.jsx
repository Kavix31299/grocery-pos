const StatusBadge = ({ children, tone = 'neutral' }) => (
  <span className={`status-badge status-badge--${tone}`}>
    {children}
  </span>
);

export default StatusBadge;
