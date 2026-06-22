"use client";

import { motion, AnimatePresence } from "framer-motion";
import { UserCheck, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/lib/store/authStore";

export function ImpersonationBanner() {
  const isImpersonating  = useAuthStore((s) => s.isImpersonating);
  const user             = useAuthStore((s) => s.user);
  const exitImpersonation = useAuthStore((s) => s.exitImpersonation);

  return (
    <AnimatePresence>
      {isImpersonating && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden"
        >
          <div className="flex items-center justify-between gap-3 bg-amber-500 px-4 py-2 text-amber-950">
            <div className="flex items-center gap-2 text-sm font-medium">
              <UserCheck className="h-4 w-4 shrink-0" />
              <span>
                Impersonating <strong>{user?.name}</strong>
                {user?.email && (
                  <span className="ml-1 font-normal opacity-70">({user.email})</span>
                )}
              </span>
            </div>
            <motion.div whileTap={{ scale: 0.97 }}>
              <Button
                size="sm"
                variant="ghost"
                onClick={exitImpersonation}
                className="h-7 gap-1.5 text-xs font-semibold text-amber-950 hover:bg-amber-600/30"
              >
                <LogOut className="h-3.5 w-3.5" />
                Exit
              </Button>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
