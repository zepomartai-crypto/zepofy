import { Outlet, Navigate } from "react-router-dom";
import MasterSidebar from "../components/MasterSidebar";
import Navbar from "../components/Navbar";
import { useAuth } from "../context/useAuth";

const MasterLayout = () => {
    const { user } = useAuth();

    // Secondary check for Super Admin role in Layout
    if (user && user.role !== "superadmin") {
        return <Navigate to="/" replace />;
    }

    return (
        <div className="flex h-screen w-screen overflow-hidden bg-white">
            {/* Master Sidebar */}
            <MasterSidebar />

            <div className="flex flex-col flex-1 overflow-hidden">
                {/* Same Navbar or customized one */}
                <Navbar />

                {/* Page Area */}
                <div className="flex-1 overflow-auto bg-slate-50">
                    <main className="w-full p-4 sm:p-6 lg:p-8">
                        <Outlet />
                    </main>
                </div>
            </div>
        </div>
    );
};

export default MasterLayout;
