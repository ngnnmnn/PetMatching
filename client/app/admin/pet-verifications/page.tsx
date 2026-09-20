import { redirect } from "next/navigation";

export default function LegacyPetVerificationsPage() {
  redirect("/admin/pets?verification=pending");
}
