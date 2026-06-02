"use client";
import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
} from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PermissionMatrix } from "./PermissionMatrix";
import {
  createRoleSchema, updateRoleSchema,
  type CreateRoleFormValues, type UpdateRoleFormValues,
} from "@/lib/validations/roleSchema";
import { useCreateRole, useUpdateRole } from "@/hooks/useRoles";
import type { Role, PermissionsMap } from "@/types";
import { CRM_MODULES } from "@/types";

const defaultPermissions: PermissionsMap = Object.fromEntries(
  CRM_MODULES.map((mod) => [
    mod,
    { view: false, create: false, edit: false, delete: false, approve: false, export: false },
  ])
) as PermissionsMap;

interface RoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role?: Role | null;
}

export function RoleDialog({ open, onOpenChange, role }: RoleDialogProps) {
  const isEditing = !!role;
  const { mutate: createRole, isPending: creating } = useCreateRole();
  const { mutate: updateRole, isPending: updating } = useUpdateRole();
  const isPending = creating || updating;

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<CreateRoleFormValues>({
    resolver: zodResolver(isEditing ? updateRoleSchema : createRoleSchema) as never,
    defaultValues: {
      roleName: "",
      description: "",
      permissions: defaultPermissions,
    },
  });

  useEffect(() => {
    if (open) {
      if (role) {
        reset({
          roleName: role.roleName,
          description: role.description ?? "",
          permissions: { ...defaultPermissions, ...role.permissions },
        });
      } else {
        reset({ roleName: "", description: "", permissions: defaultPermissions });
      }
    }
  }, [open, role, reset]);

  const onSubmit = (data: CreateRoleFormValues) => {
    if (isEditing) {
      updateRole(
        { id: role._id, data: data as UpdateRoleFormValues },
        { onSuccess: () => onOpenChange(false) }
      );
    } else {
      createRole(data, { onSuccess: () => onOpenChange(false) });
    }
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent desktopClassName="max-w-4xl max-h-[90vh] overflow-y-auto">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>{isEditing ? "Edit Role" : "Create New Role"}</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Configure role name and set granular permissions for each module.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 px-4 sm:px-0">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Role Name */}
            <div className="space-y-1.5">
              <Label htmlFor="roleName">Role Name *</Label>
              <Input
                id="roleName"
                placeholder="e.g. Sales Manager"
                {...register("roleName")}
                disabled={isEditing && role?.isSystemRole && role.roleName === "Super Admin"}
              />
              {errors.roleName && (
                <p className="text-xs text-destructive">{errors.roleName.message}</p>
              )}
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="Brief description of this role"
                {...register("description")}
              />
            </div>
          </div>

          {/* Permission Matrix */}
          <div className="space-y-3">
            <div>
              <h4 className="text-sm font-semibold">Permissions Matrix</h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Configure access for each module. Use the &quot;All&quot; column to toggle all permissions for a row.
              </p>
            </div>
            <Controller
              name="permissions"
              control={control}
              render={({ field }) => (
                <PermissionMatrix
                  value={(field.value as PermissionsMap) ?? defaultPermissions}
                  onChange={field.onChange}
                  disabled={isEditing && role?.isSystemRole && role.roleName === "Super Admin"}
                />
              )}
            />
          </div>

          <ResponsiveDialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEditing ? "Save Changes" : "Create Role"}
            </Button>
          </ResponsiveDialogFooter>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
