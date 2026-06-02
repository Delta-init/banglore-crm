"use client";
import { useCallback } from "react";
import { motion } from "framer-motion";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { CRM_MODULES, MODULE_LABELS, type PermissionsMap, type CrmModule, type PermissionAction, type ModulePermissions } from "@/types";

const ACTIONS: { key: PermissionAction; label: string }[] = [
  { key: "view", label: "View" },
  { key: "create", label: "Create" },
  { key: "edit", label: "Edit" },
  { key: "delete", label: "Delete" },
  { key: "approve", label: "Approve" },
  { key: "export", label: "Export" },
];

const DEFAULT_MODULE_PERMS: ModulePermissions = {
  view: false,
  create: false,
  edit: false,
  delete: false,
  approve: false,
  export: false,
};

interface PermissionMatrixProps {
  value: PermissionsMap;
  onChange: (permissions: PermissionsMap) => void;
  disabled?: boolean;
}

export function PermissionMatrix({ value, onChange, disabled }: PermissionMatrixProps) {
  const getModulePerms = useCallback(
    (mod: CrmModule): ModulePermissions => ({
      ...DEFAULT_MODULE_PERMS,
      ...(value[mod] ?? {}),
    }),
    [value]
  );

  const handleToggle = useCallback(
    (mod: CrmModule, action: PermissionAction, checked: boolean) => {
      onChange({
        ...value,
        [mod]: { ...getModulePerms(mod), [action]: checked },
      });
    },
    [value, onChange, getModulePerms]
  );

  const handleToggleAll = useCallback(
    (mod: CrmModule, checked: boolean) => {
      const updated: ModulePermissions = {
        view: checked,
        create: checked,
        edit: checked,
        delete: checked,
        approve: checked,
        export: checked,
      };
      onChange({ ...value, [mod]: updated });
    },
    [value, onChange]
  );

  const handleToggleColumn = useCallback(
    (action: PermissionAction, checked: boolean) => {
      const updated: PermissionsMap = {};
      for (const mod of CRM_MODULES) {
        updated[mod] = { ...getModulePerms(mod), [action]: checked };
      }
      onChange({ ...value, ...updated });
    },
    [value, onChange, getModulePerms]
  );

  const handleToggleEverything = useCallback(
    (checked: boolean) => {
      const updated: PermissionsMap = {};
      for (const mod of CRM_MODULES) {
        updated[mod] = {
          view: checked, create: checked, edit: checked,
          delete: checked, approve: checked, export: checked,
        };
      }
      onChange(updated);
    },
    [onChange]
  );

  const isModuleAllChecked = (mod: CrmModule) => {
    const perms = getModulePerms(mod);
    return ACTIONS.every(({ key }) => perms[key]);
  };

  const isModulePartialChecked = (mod: CrmModule) => {
    const perms = getModulePerms(mod);
    const checked = ACTIONS.filter(({ key }) => perms[key]).length;
    return checked > 0 && checked < ACTIONS.length;
  };

  const isColumnAllChecked = (action: PermissionAction) =>
    CRM_MODULES.every((mod) => getModulePerms(mod)[action]);

  const isEverythingChecked = () =>
    CRM_MODULES.every((mod) => ACTIONS.every(({ key }) => getModulePerms(mod)[key]));

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[700px]">
        {/* Head */}
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <th className="px-5 py-3 text-left">
              <div className="flex items-center gap-2.5">
                <Checkbox
                  disabled={disabled}
                  checked={isEverythingChecked()}
                  onCheckedChange={(c) => handleToggleEverything(!!c)}
                />
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Module
                </span>
              </div>
            </th>
            {ACTIONS.map(({ key, label }) => (
              <th key={key} className="px-3 py-3 text-center">
                <div className="flex flex-col items-center gap-1.5">
                  <Checkbox
                    disabled={disabled}
                    checked={isColumnAllChecked(key)}
                    onCheckedChange={(c) => handleToggleColumn(key, !!c)}
                  />
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {label}
                  </span>
                </div>
              </th>
            ))}
            <th className="px-4 py-3 text-center">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                All
              </span>
            </th>
          </tr>
        </thead>

        {/* Body */}
        <tbody className="divide-y divide-border">
          {CRM_MODULES.map((mod, i) => {
            const perms = getModulePerms(mod);
            const allChecked = isModuleAllChecked(mod);
            const partialChecked = isModulePartialChecked(mod);

            return (
              <motion.tr
                key={mod}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className={cn(
                  "group transition-colors",
                  allChecked ? "bg-primary/5" : "hover:bg-muted/20"
                )}
              >
                {/* Module name */}
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={cn(
                        "h-2 w-2 rounded-full flex-shrink-0 transition-colors",
                        allChecked
                          ? "bg-primary"
                          : partialChecked
                          ? "bg-amber-400"
                          : "bg-muted-foreground/30"
                      )}
                    />
                    <span className="text-sm font-medium">{MODULE_LABELS[mod]}</span>
                  </div>
                </td>

                {/* Action checkboxes */}
                {ACTIONS.map(({ key }) => (
                  <td key={key} className="px-3 py-3.5 text-center">
                    <div className="flex justify-center">
                      <Checkbox
                        disabled={disabled}
                        checked={perms[key]}
                        onCheckedChange={(c) => handleToggle(mod, key, !!c)}
                        className={cn(
                          "transition-all",
                          perms[key] && "border-primary"
                        )}
                      />
                    </div>
                  </td>
                ))}

                {/* Toggle All for row */}
                <td className="px-4 py-3.5 text-center">
                  <div className="flex justify-center">
                    <Checkbox
                      disabled={disabled}
                      checked={allChecked}
                      onCheckedChange={(c) => handleToggleAll(mod, !!c)}
                      className={cn(
                        "h-5 w-5 rounded transition-all",
                        allChecked && "border-primary bg-primary"
                      )}
                    />
                  </div>
                </td>
              </motion.tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
