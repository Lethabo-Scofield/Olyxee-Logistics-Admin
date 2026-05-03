import { useState } from "react";
import { Link } from "wouter";
import { useListCustomers, useCreateCustomer } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, ChevronRight, Users } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

function CreateCustomerSheet({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ fullName: "", email: "", phone: "", companyName: "", address: "" });
  const createMutation = useCreateCustomer();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(
      { data: { fullName: form.fullName, email: form.email, phone: form.phone || undefined, companyName: form.companyName || undefined, address: form.address || undefined } },
      {
        onSuccess: () => {
          toast.success("Customer created successfully");
          setOpen(false);
          setForm({ fullName: "", email: "", phone: "", companyName: "", address: "" });
          onSuccess();
        },
        onError: () => toast.error("Failed to create customer"),
      }
    );
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button className="gap-2"><Plus className="h-4 w-4" /> New Customer</Button>
      </SheetTrigger>
      <SheetContent className="w-[400px]">
        <SheetHeader>
          <SheetTitle>New Customer</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name *</Label>
            <Input id="fullName" value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input id="email" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="companyName">Company Name</Label>
            <Input id="companyName" value={form.companyName} onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Input id="address" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
          </div>
          <Button type="submit" className="w-full mt-2" disabled={createMutation.isPending}>
            {createMutation.isPending ? "Creating..." : "Create Customer"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

export default function CustomersPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [querySearch, setQuerySearch] = useState("");

  const { data, isLoading, refetch } = useListCustomers({ search: querySearch || undefined, page, limit: 20 });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setQuerySearch(search);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Customers</h1>
          <p className="text-gray-500 mt-1">{data?.total ?? 0} total customers</p>
        </div>
        <CreateCustomerSheet onSuccess={() => refetch()} />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input className="pl-9" placeholder="Search by name, email, or company..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Button type="submit" variant="secondary">Search</Button>
          </form>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : !data?.data.length ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Users className="h-12 w-12 text-gray-300 mb-4" />
              <p className="text-gray-500 font-medium">No customers found</p>
              <p className="text-gray-400 text-sm mt-1">Create your first customer to get started</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Since</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.data.map((customer) => (
                    <TableRow key={customer.id} className="cursor-pointer hover:bg-gray-50">
                      <TableCell className="font-medium">
                        <Link href={`/customers/${customer.id}`} className="hover:underline text-blue-600">
                          {customer.fullName}
                        </Link>
                      </TableCell>
                      <TableCell className="text-gray-600">{customer.email}</TableCell>
                      <TableCell className="text-gray-600">{customer.companyName ?? "—"}</TableCell>
                      <TableCell className="text-gray-600">{customer.phone ?? "—"}</TableCell>
                      <TableCell className="text-gray-500 text-sm">
                        {format(new Date(customer.createdAt), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>
                        <Link href={`/customers/${customer.id}`}>
                          <ChevronRight className="h-4 w-4 text-gray-400" />
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {data.total > 20 && (
                <div className="flex items-center justify-between px-6 py-4 border-t">
                  <span className="text-sm text-gray-500">Page {page} of {Math.ceil(data.total / 20)}</span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
                    <Button variant="outline" size="sm" disabled={page >= Math.ceil(data.total / 20)} onClick={() => setPage(p => p + 1)}>Next</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
