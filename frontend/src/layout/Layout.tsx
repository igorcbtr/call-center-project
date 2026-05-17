import { Outlet, useLocation } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import styles from './Layout.module.css';
import { useAuth } from '../hooks/useAuth';

export function Layout() {
  const { role } = useAuth();
  const location = useLocation();
  const showSidebar = role === 'admin' && location.pathname.startsWith('/admin');

  return (
    <div className={styles.shell}>
      <Header />
      <div className={styles.body}>
        {showSidebar ? <Sidebar /> : null}
        <main className={showSidebar ? styles.main : styles.mainFull}>
          <div className={styles.content}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
