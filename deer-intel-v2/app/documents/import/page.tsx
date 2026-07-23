import { redirect } from "next/navigation";

// The document importer now lives on the Documents hub (which also lists what's
// been added), so keep this old route working by sending it there.
export default function DocumentImportRedirect() {
  redirect("/documents");
}
