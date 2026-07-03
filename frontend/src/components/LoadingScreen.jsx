const LoadingScreen = ({ label = 'Loading' }) => (
  <div className="loading-screen">
    <div className="loading-dot" />
    <span>{label}</span>
  </div>
);

export default LoadingScreen;
