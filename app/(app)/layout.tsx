import { AppSidebar } from "@/components/app-sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <main className="relative ml-60 min-h-screen px-8 py-7">{children}</main>
    </div>
  );
}
