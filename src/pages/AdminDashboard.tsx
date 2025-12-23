import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { Button } from '@/components/ui/button';
import { CSVImport } from '@/components/admin/CSVImport';
import { DataTable } from '@/components/admin/DataTable';
import { LogOut, Database } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function AdminDashboard() {
  const { isAdmin, loading, signOut } = useAdminAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !isAdmin) {
      navigate('/login');
    }
  }, [isAdmin, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">MealDeal Admin</h1>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="outline" onClick={signOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="import" className="space-y-6">
          <TabsList>
            <TabsTrigger value="import">Import Data</TabsTrigger>
            <TabsTrigger value="view">View Data</TabsTrigger>
          </TabsList>

          <TabsContent value="import" className="space-y-4">
            <CSVImport />
          </TabsContent>

          <TabsContent value="view" className="space-y-4">
            <DataTable />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
