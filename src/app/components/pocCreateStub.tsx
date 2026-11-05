/**
 * Stub for the Partners `CreatePocModal` — the ported
 * `ContactsDirectoryPage` references it to render its Create / Edit
 * Contact flow, but inside the PO-Detail Select POCs modal we don't
 * need that flow (the user is *picking* existing contacts, not
 * creating new ones). The real modal lives in
 * `Partners/.../PocModals.tsx`; this stub satisfies the prop shape
 * with a tiny dialog that just closes when opened, so the consumer's
 * "Create New Contact" button is effectively a no-op.
 */
import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "./ui/dialog";
import { Button } from "./ui/button";
import type { ContactPerson } from "./pocDirectoryData";

interface CreatePocModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contextName?: string;
  editMode?: boolean;
  editContactName?: string;
  editContact?: ContactPerson | null;
  newPocName: string;
  onNewPocNameChange: (v: string) => void;
  newPocDepartment: string;
  onNewPocDepartmentChange: (v: string) => void;
  newPocRole: string;
  onNewPocRoleChange: (v: string) => void;
  newPocLandline: string;
  onNewPocLandlineChange: (v: string) => void;
  newPocLandlineCode: string;
  onNewPocLandlineCodeChange: (v: string) => void;
  newPocExt: string;
  onNewPocExtChange: (v: string) => void;
  newPocMobile: string;
  onNewPocMobileChange: (v: string) => void;
  newPocMobileCode: string;
  onNewPocMobileCodeChange: (v: string) => void;
  newPocEmail: string;
  onNewPocEmailChange: (v: string) => void;
  saveAndCreateAnother: boolean;
  onSaveAndCreateAnotherChange: (v: boolean) => void;
  onSave: () => void;
}

export function CreatePocModal({ open, onOpenChange, editMode }: CreatePocModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>{editMode ? "Edit Contact" : "Create Contact"}</DialogTitle>
          <DialogDescription>
            Creating contacts isn't available inside this picker. Use the Contacts Directory in the
            Partners app to manage contacts.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
