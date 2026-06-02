"use client";
import { useState, useMemo, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Plus, Search, Pencil, Trash2, Loader2, Shield, Lock, ChevronLeft, ChevronRight, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RoleDialog } from "@/components/roles/RoleDialog";
import { DeleteRoleDialog } from "@/components/roles/DeleteRoleDialog";
import { useRoles } from "@/hooks/useRoles";
import { useAuthStore } from "@/lib/store/authStore";
import { formatDate } from "@/lib/utils";
import { CRM_MODULES, type PermissionsMap } from "@/types";
import type { Role } from "@/types";

function PermissionSummary({ permissions }: { permissions: PermissionsMap }) {
  const totalModules = CRM_MODULES.length;
  const totalPossible = totalModules * 6;
  const granted = CRM_MODULES.reduce((acc, mod) => {
    const perms = permissions[mod];
    if (!perms) return acc;
    return acc + Object.values(perms).filter(Boolean).length;
  }, 0);
  const pct = Math.round((granted / totalPossible) * 100);

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground">{pct}%</span>
    </div>
  );
}

function RolesPageContent() {
  const sp = useSearchParams();
  const router = useRouter();
  const { hasPermission } = useAuthStore();
  const [search, setSearch] = useState(() => sp.get("q") ?? "");
  const [page, setPage] = useState(() => Number(sp.get("page") ?? "1"));
  const [sortField, setSortField] = useState<"createdAt" | "roleName">(() => (sp.get("sortBy") as "createdAt" | "roleName") ?? "createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(() => (sp.get("sortOrder") as "asc" | "desc") ?? "desc");

  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (page > 1) params.set("page", String(page));
    if (sortField !== "createdAt") params.set("sortBy", sortField);
    if (sortOrder !== "desc") params.set("sortOrder", sortOrder);
    router.replace(`?${params.toString()}`, { scroll: false });
  }, [search, page, sortField, sortOrder]);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const params = useMemo(() => {
    const p: Record<string, string> = {
      page: String(page),
      limit: "10",
    };
    if (search) p.search = search;
    if (sortField) p.sortBy = sortField;
    if (sortOrder) p.sortOrder = sortOrder;
    return p;
  }, [page, search, sortField, sortOrder]);

  const { data, isLoading, isFetching } = useRoles(params);

  const roles = data?.data ?? [];
  const pagination = data?.pagination;

  const canCreate = hasPermission("roles", "create");
  const canEdit = hasPermission("roles", "edit");
  const canDelete = hasPermission("roles", "delete");

  const handleCreate = () => {
    setSelectedRole(null);
    setDialogOpen(true);
  };

  const handleEdit = (role: Role) => {
    setSelectedRole(role);
    setDialogOpen(true);
  };

  const handleDelete = (role: Role) => {
    setSelectedRole(role);
    setDeleteOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h2 className="text-2xl font-bold">Roles & Permissions</h2>
          <p className="text-muted-foreground text-sm mt-0.5">
            Manage roles with granular permission control per module
          </p>
        </div>
        {canCreate && (
          <Button onClick={handleCreate} className="w-full sm:w-auto">
            <Plus className="h-4 w-4" />
            Create Role
          </Button>
        )}
      </motion.div>

      {/* Roles Table */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
      >
        <Card className="border-border/50">
          <CardHeader className="pb-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search roles..."
                  className="pl-9"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                />
              </div>
              <div className="flex items-center gap-3">
                <Select value={sortField} onValueChange={(v) => { setSortField(v as "createdAt" | "roleName"); setPage(1); }}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="createdAt">Created Date</SelectItem>
                    <SelectItem value="roleName">Role Name</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-10 w-10"
                  onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                  title={sortOrder === "asc" ? "Ascending" : "Descending"}
                >
                  {sortOrder === "asc" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : roles.length === 0 ? (
              <div className="py-20 text-center">
                <Shield className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-muted-foreground">No roles found</p>
                {canCreate && (
                  <Button variant="outline" className="mt-4" onClick={handleCreate}>
                    <Plus className="h-4 w-4" /> Create first role
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/30 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      <th className="px-6 py-3 text-left">Role</th>
                      <th className="px-6 py-3 text-left">Description</th>
                      <th className="px-6 py-3 text-left">Permission Coverage</th>
                      <th className="px-6 py-3 text-left">Type</th>
                      <th className="px-6 py-3 text-left">Created</th>
                      {(canEdit || canDelete) && (
                        <th className="px-6 py-3 text-right">Actions</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {roles.map((role, i) => (
                      <motion.tr
                        key={role._id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className="group hover:bg-muted/20 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                              {role.isSystemRole ? (
                                <Lock className="h-4 w-4 text-primary" />
                              ) : (
                                <Shield className="h-4 w-4 text-primary" />
                              )}
                            </div>
                            <span className="font-medium text-sm">{role.roleName}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-muted-foreground">
                            {role.description || "—"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <PermissionSummary permissions={role.permissions} />
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant={role.isSystemRole ? "default" : "secondary"}>
                            {role.isSystemRole ? "System" : "Custom"}
                          </Badge>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-muted-foreground">
                            {formatDate(role.createdAt)}
                          </span>
                        </td>
                        {(canEdit || canDelete) && (
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-end gap-2">
                              {canEdit && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 md:opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={() => handleEdit(role)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              )}
                              {canDelete && !role.isSystemRole && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 md:opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                                  onClick={() => handleDelete(role)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </td>
                        )}
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-border px-6 py-4">
                <p className="text-sm text-muted-foreground">
                  Showing {(pagination.page - 1) * pagination.limit + 1}–
                  {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} roles
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    disabled={!pagination.hasPrevPage || isFetching}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm font-medium">
                    {pagination.page} / {pagination.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    disabled={!pagination.hasNextPage || isFetching}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <RoleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        role={selectedRole}
      />
      <DeleteRoleDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        role={selectedRole}
      />
    </div>
  );
}

export default function RolesPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <RolesPageContent />
    </Suspense>
  );
}
