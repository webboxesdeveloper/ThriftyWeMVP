import { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { api } from '@/services/api';
import { Loader2 } from 'lucide-react';

const TABLES = {
  dishes: 'Dishes',
  ingredients: 'Ingredients',
  offers: 'Offers',
  chains: 'Chains',
  stores: 'Stores',
  lookups_categories: 'Categories',
  // ad_regions: 'Ad Regions',
  // store_region_map: 'Store-Region Map',
  postal_codes: 'Postal Codes',
  dish_ingredients: 'Dish Ingredients',
};

export function DataTable() {
  const [selectedTable, setSelectedTable] = useState('dishes');
  const [data, setData] = useState<Record<string, any>[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const itemsPerPage = 50;

  useEffect(() => {
    if (selectedTable) {
      setCurrentPage(1); // Reset to page 1 when table changes - this will trigger the fetch in the next useEffect
    }
  }, [selectedTable]);

  useEffect(() => {
    if (selectedTable) {
      fetchData(currentPage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTable, currentPage]);

  const fetchData = async (page: number) => {
    setLoading(true);
    try {
      const offset = (page - 1) * itemsPerPage;
      const result = await api.getTableData(selectedTable, itemsPerPage, offset);

      if (result.data && result.data.length > 0) {
        setColumns(Object.keys(result.data[0]));
        setData(result.data);
        setTotalCount(result.count);
      } else {
        setColumns([]);
        setData([]);
        setTotalCount(0);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setColumns([]);
      setData([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.ceil(totalCount / itemsPerPage);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Database Viewer</CardTitle>
        <CardDescription>
          View and inspect database tables
          {totalCount > 0 && ` (${totalCount} total records, showing page ${currentPage} of ${totalPages})`}
        </CardDescription>
        <div className="pt-4">
          <Select value={selectedTable} onValueChange={setSelectedTable}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select table" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(TABLES).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : data.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No data available
          </div>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((col) => (
                    <TableHead key={col} className="whitespace-nowrap">
                      {col}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((row, idx) => (
                  <TableRow key={idx}>
                    {columns.map((col) => (
                      <TableCell key={col} className="whitespace-nowrap">
                        {JSON.stringify(row[col])}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        
        {!loading && data.length > 0 && totalPages > 1 && (
          <div className="mt-4 flex justify-center">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={(e) => {
                      e.preventDefault();
                      if (currentPage > 1) handlePageChange(currentPage - 1);
                    }}
                    className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    href="#"
                  />
                </PaginationItem>
                
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                  // Show first page, last page, current page, and pages around current
                  if (
                    page === 1 ||
                    page === totalPages ||
                    (page >= currentPage - 1 && page <= currentPage + 1)
                  ) {
                    return (
                      <PaginationItem key={page}>
                        <PaginationLink
                          onClick={(e) => {
                            e.preventDefault();
                            handlePageChange(page);
                          }}
                          isActive={currentPage === page}
                          className="cursor-pointer"
                          href="#"
                        >
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                    );
                  } else if (page === currentPage - 2 || page === currentPage + 2) {
                    return (
                      <PaginationItem key={page}>
                        <PaginationEllipsis />
                      </PaginationItem>
                    );
                  }
                  return null;
                })}
                
                <PaginationItem>
                  <PaginationNext
                    onClick={(e) => {
                      e.preventDefault();
                      if (currentPage < totalPages) handlePageChange(currentPage + 1);
                    }}
                    className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    href="#"
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
