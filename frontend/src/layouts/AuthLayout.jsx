const AuthLayout = ({ children }) => (
  <main className="auth-layout">
    <section className="auth-panel">
      <div className="brand-block">
        <span>Grocery POS</span>
        <h1>Store operations, ready at the counter.</h1>
      </div>
      {children}
    </section>
  </main>
);

export default AuthLayout;
