import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar, MobileSidebar } from "./Sidebar.jsx";
import Topbar from "./Topbar.jsx";
import SearchModal from "./SearchModal.jsx";

export default function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const openSearch = () => setSearchOpen(true);
    window.addEventListener("gateway:open-search", openSearch);
    return () => window.removeEventListener("gateway:open-search", openSearch);
  }, []);

  return (
    <div className="relative flex min-h-screen bg-[#0c0d0e] text-[#d4d4d8]">
      <Sidebar />
      <MobileSidebar open={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenSidebar={() => setMobileOpen(true)} onOpenSearch={() => setSearchOpen(true)} />
        <main className="relative mx-auto w-full max-w-[1440px] flex-1 px-4 py-5 sm:px-7 sm:py-6 xl:px-9">
          <Outlet />
        </main>
      </div>
      <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
