import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useListCustomers, useCreateCustomer } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Users, X } from "lucide-react";
import { EmptyState } from "@/components/page-loader";
import { toast } from "sonner";
import { format } from "date-fns";

const AVATAR = `${import.meta.env.BASE_URL}avatar-placeholder.png`;

function CustomerAvatar({ name, size = "sm" }: { name: string; size?: "sm" | "lg" }) {
  const dim = size === "lg" ? "h-16 w-16" : "h-8 w-8";
  return (
    <div className={`${dim} flex-shrink-0 overflow-hidden bg-muted border`}>
      <img src={AVATAR} alt={name} className="h-full w-full object-cover opacity-60" />
    </div>
  );
}

function CreateCustomerDialog({ onSuccess }: { onSuccess: () => void }) {
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2"><Plus className="h-4 w-4" /> New Customer</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>New Customer</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="mt-2 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2">
              <Label htmlFor="fullName">Full Name *</Label>
              <Input id="fullName" value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} required />
            </div>
            <div className="space-y-2 col-span-2">
              <Label htmlFor="email">Email *</Label>
              <Input id="email" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="companyName">Company</Label>
              <Input id="companyName" value={form.companyName} onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))} />
            </div>
            <div className="space-y-2 col-span-2">
              <Label htmlFor="address">Address</Label>
              <Input id="address" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
            </div>
          </div>
          <Button type="submit" className="w-full mt-2" disabled={createMutation.isPending}>
            {createMutation.isPending ? "Creating..." : "Create Customer"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Tri-state filter values:
//   "any"  → don't send the param
//   "yes"  → hasX=true
//   "no"   → hasX=false
type TriFilter = "any" | "yes" | "no";
type SortValue = "newest" | "oldest" | "name";

function triToParam(v: TriFilter): boolean | undefined {
  return v === "yes" ? true : v === "no" ? false : undefined;
}

export default function CustomersPage() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [querySearch, setQuerySearch] = useState("");
  const [hasCompany, setHasCompany] = useState<TriFilter>("any");
  const [hasPhone, setHasPhone] = useState<TriFilter>("any");
  const [sort, setSort] = useState<SortValue>("newest");

  const { data, isLoading, refetch } = useListCustomers({
    search: querySearch || undefined,
    hasCompany: triToParam(hasCompany),
    hasPhone: triToParam(hasPhone),
    sort,
    page,
    limit: 20,
  });

  // Any time a filter that's part of the query changes, jump back to page 1
  // so the user isn't stranded on a now-empty page N.
  const updateFilter = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setPage(1);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setQuerySearch(search);
    setPage(1);
  };

  const filtersActive =
    hasCompany !== "any" || hasPhone !== "any" || sort !== "newest" || !!querySearch;

  const handleClearAll = () => {
    setSearch("");
    setQuerySearch("");
    setHasCompany("any");
    setHasPhone("any");
    setSort("newest");
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{data?.total ?? 0} total customers</p>
        </div>
        <CreateCustomerDialog onSuccess={() => refetch()} />
      </div>

      <Card>
        <CardHeader className="pb-3 space-y-3">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search by name, email, or company..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Button type="submit" variant="secondary">Search</Button>
          </form>

          {/* Filter row — applies immediately on change (no separate Apply button). */}
          <div className="flex flex-wrap items-center gap-2">
            <Select value={hasCompany} onValueChange={updateFilter(setHasCompany) as (v: string) => void}>
              <SelectTrigger className="h-9 w-[160px]">
                <SelectValue placeholder="Company" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any company</SelectItem>
                <SelectItem value="yes">Has company</SelectItem>
                <SelectItem value="no">No company</SelectItem>
              </SelectContent>
            </Select>

            <Select value={hasPhone} onValueChange={updateFilter(setHasPhone) as (v: string) => void}>
              <SelectTrigger className="h-9 w-[160px]">
                <SelectValue placeholder="Phone" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any phone</SelectItem>
                <SelectItem value="yes">Has phone</SelectItem>
                <SelectItem value="no">No phone</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sort} onValueChange={updateFilter(setSort) as (v: string) => void}>
              <SelectTrigger className="h-9 w-[160px]">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest first</SelectItem>
                <SelectItem value="oldest">Oldest first</SelectItem>
                <SelectItem value="name">Name (A–Z)</SelectItem>
              </SelectContent>
            </Select>

            {filtersActive && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1 text-muted-foreground"
                onClick={handleClearAll}
              >
                <X className="h-3.5 w-3.5" /> Clear
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 flex-shrink-0" />
                  <Skeleton className="h-5 flex-1" />
                </div>
              ))}
            </div>
          ) : !data?.data.length ? (
            <EmptyState
              icon={<Users className="h-12 w-12" />}
              title="No customers found"
              description="Create your first customer to get started."
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Since</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.data.map((customer) => (
                    <TableRow
                      key={customer.id}
                      className="cursor-pointer hover:bg-muted/40 group"
                      onClick={() => navigate(`/customers/${customer.id}`)}
                    >
                      <TableCell>
                        <CustomerAvatar name={customer.fullName} />
                      </TableCell>
                      <TableCell className="font-semibold">
                        {customer.fullName}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{customer.email}</TableCell>
                      <TableCell className="text-muted-foreground">{customer.companyName ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{customer.phone ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(customer.createdAt), "MMM d, yyyy")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {data.total > 20 && (
                <div className="flex items-center justify-between px-6 py-4 border-t">
                  <span className="text-sm text-muted-foreground">Page {page} of {Math.ceil(data.total / 20)}</span>
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
