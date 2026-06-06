import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "/src/context/useAuth.jsx";
import hero from "/src/assets/loginwp.png";

const Auth = ({ initialMode }) => {
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(name, email, password);
      }
      navigate("/");
    } catch (err) {
      alert(err.response?.data?.error || `${mode === 'login' ? 'Login' : 'Register'} failed`);
    }
  };

  const switchMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-6">
      {/* MAIN CONTAINER */}
      <div className="w-full max-w-6xl bg-white rounded-[12px] shadow-xl overflow-hidden min-h-[600px] relative">
        <div className={`flex transition-transform duration-700 ease-in-out ${mode === 'login' ? 'translate-x-0' : '-translate-x-full'}`}>
          {/* LOGIN PANEL */}
          <div className="w-full lg:w-1/2 flex-shrink-0 p-10 lg:p-14 flex flex-col justify-center">
            <div className="max-w-md mx-auto w-full">
              <h1 className="text-3xl font-bold text-slate-900 mb-2">Welcome Back</h1>
              <p className="text-slate-600 mb-8">Sign in to your WhatsApp Automation account</p>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Email Address</label>
                  <input
                    type="email"
                    placeholder="Enter your email"
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Password</label>
                  <input
                    type="password"
                    placeholder="Enter your password"
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-gradient-to-br from-blue-600 to-purple-600 hover:brightness-110 shadow-md active:bg-blue-800 text-white py-3 rounded-lg font-semibold transition-colors shadow-[0px_4px_12px_rgba(0,0,0,0.05)]"
                >
                  Sign In
                </button>
              </form>
              <div className="flex justify-between items-center text-sm mt-6 text-slate-600">
                <span className="hover:text-slate-800 cursor-pointer">Forgot Password?</span>
                <button
                  onClick={switchMode}
                  className="text-blue-600 font-medium hover:text-blue-700 transition-colors"
                >
                  Create Account
                </button>
              </div>
            </div>
          </div>

          {/* IMAGE PANEL */}
          <div className="w-full lg:w-1/2 flex-shrink-0 relative bg-slate-900">
            <div
              className="absolute inset-0 bg-cover bg-center opacity-90"
              style={{
                backgroundImage: `url(${hero})`,
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 to-slate-900/60" />
            <div className="relative z-10 flex items-center justify-center h-full p-8">
              <div className="text-center text-white">
                <h2 className="text-2xl font-bold mb-4">Automate Your WhatsApp</h2>
                <p className="text-slate-200">Manage campaigns, templates, and contacts effortlessly</p>
              </div>
            </div>
          </div>

          {/* REGISTER PANEL */}
          <div className="w-full lg:w-1/2 flex-shrink-0 p-10 lg:p-14 flex flex-col justify-center">
            <div className="max-w-md mx-auto w-full">
              <h1 className="text-3xl font-bold text-slate-900 mb-2">Create Account</h1>
              <p className="text-slate-600 mb-8">Join WhatsApp Automation platform</p>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Full Name</label>
                  <input
                    type="text"
                    placeholder="Enter your full name"
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Email Address</label>
                  <input
                    type="email"
                    placeholder="Enter your email"
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Password</label>
                  <input
                    type="password"
                    placeholder="Create a password"
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-gradient-to-br from-blue-600 to-purple-600 hover:brightness-110 shadow-md active:bg-blue-800 text-white py-3 rounded-lg font-semibold transition-colors shadow-[0px_4px_12px_rgba(0,0,0,0.05)]"
                >
                  Create Account
                </button>
              </form>
              <div className="flex justify-end text-sm mt-6 text-slate-600">
                <button
                  onClick={switchMode}
                  className="text-blue-600 font-medium hover:text-blue-700 transition-colors"
                >
                  Already have an account? Sign In
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;