"use client"

import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import AppHeader from "@/components/layout/AppHeader"
import { PetProfileForm } from "@/components/pet-profile-form"
import { Button } from "@/components/ui/button"

export default function NewPetProfilePage() {
  const router = useRouter()

  return (
    <main className="min-h-screen bg-background text-foreground">
      <AppHeader sectionLabel="Thú cưng" />
      <section className="border-b bg-card">
        <div className="container mx-auto flex items-center justify-between gap-4 px-4 py-6">
          <div>
            <Button variant="ghost" size="sm" className="mb-3 gap-2 px-0" asChild>
              <Link href="/my-pets">
                <ArrowLeft className="size-4" />
                Quay lại
              </Link>
            </Button>
            <h1 className="text-3xl font-bold">Tạo hồ sơ thú cưng</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Điền thông tin cơ bản để hồ sơ có thể tham gia ghép đôi.
            </p>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-8">
        <PetProfileForm onComplete={() => router.push("/my-pets")} />
      </section>
    </main>
  )
}
