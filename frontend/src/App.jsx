import AppRoutes from "./routes/AppRoutes";
import { FlowProvider } from "./context/FlowContext";
import { AuthProvider } from "./context/useAuth";
import { Toaster } from 'react-hot-toast';

function App() {
  return (
    <AuthProvider>
      <FlowProvider>
        <AppRoutes />
        <Toaster position="top-right" />
      </FlowProvider>
    </AuthProvider>
  );
}

export default App;
