// Re-export the canonical contact directory used elsewhere in the
// Quote/SO modules (recipients picker, change-customer flow) so the
// verbatim PocModals.tsx port lands on the same rich table-view picker
// instead of the slim shim that originally lived here.
export {
  ContactsDirectoryPage,
  type ContactsDirectoryPageProps,
} from "../../shared/contactDirectory/ContactsDirectoryPage";
