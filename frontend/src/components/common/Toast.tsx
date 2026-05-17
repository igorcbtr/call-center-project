import { ToastContainer } from 'react-toastify';

export function AppToast() {
  return (
    <ToastContainer
      position="top-right"
      autoClose={4000}
      hideProgressBar={false}
      newestOnTop
      closeOnClick
      pauseOnHover
      theme="light"
      toastClassName="mvp-toast"
    />
  );
}
