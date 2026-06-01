"use client"

import { useState } from "react"
import { PawPrint, Plus, Search, Heart, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PetProfileForm } from "@/components/pet-profile-form"
import { PetDiscovery } from "@/components/pet-discovery"
import { samplePets } from "@/lib/pet-data"
import { cn } from "@/lib/utils"

export default function HomePage() {
  const [activeTab, setActiveTab] = useState("discover")
  const [showCreateForm, setShowCreateForm] = useState(false)

  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <a href="/" className="flex items-center gap-2 font-bold text-xl">
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                <PawPrint className="w-6 h-6 text-primary-foreground" />
              </div>
              <span className="hidden sm:inline">PetMatch</span>
            </a>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-1">
              <Button
                variant={activeTab === "discover" ? "default" : "ghost"}
                onClick={() => { setActiveTab("discover"); setShowCreateForm(false) }}
                className="gap-2"
              >
                <Search className="w-4 h-4" />
                Khám phá
              </Button>
              <Button
                variant={activeTab === "favorites" ? "default" : "ghost"}
                onClick={() => { setActiveTab("favorites"); setShowCreateForm(false) }}
                className="gap-2"
              >
                <Heart className="w-4 h-4" />
                Yêu thích
              </Button>
              <Button
                variant={activeTab === "my-pets" ? "default" : "ghost"}
                onClick={() => { setActiveTab("my-pets"); setShowCreateForm(false) }}
                className="gap-2"
              >
                <PawPrint className="w-4 h-4" />
                Thú cưng của tôi
              </Button>
            </div>

            {/* Right Side */}
            <div className="flex items-center gap-2">
              <Button onClick={() => setShowCreateForm(true)} className="gap-2">
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Tạo hồ sơ</span>
              </Button>
              <Button variant="ghost" size="icon">
                <User className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Navigation Tabs */}
      <div className="md:hidden sticky top-16 z-40 bg-background border-b">
        <div className="flex">
          <button
            onClick={() => { setActiveTab("discover"); setShowCreateForm(false) }}
            className={cn(
              "flex-1 py-3 text-sm font-medium transition-colors",
              activeTab === "discover" ? "text-primary border-b-2 border-primary" : "text-muted-foreground"
            )}
          >
            <Search className="w-4 h-4 mx-auto mb-1" />
            Khám phá
          </button>
          <button
            onClick={() => { setActiveTab("favorites"); setShowCreateForm(false) }}
            className={cn(
              "flex-1 py-3 text-sm font-medium transition-colors",
              activeTab === "favorites" ? "text-primary border-b-2 border-primary" : "text-muted-foreground"
            )}
          >
            <Heart className="w-4 h-4 mx-auto mb-1" />
            Yêu thích
          </button>
          <button
            onClick={() => { setActiveTab("my-pets"); setShowCreateForm(false) }}
            className={cn(
              "flex-1 py-3 text-sm font-medium transition-colors",
              activeTab === "my-pets" ? "text-primary border-b-2 border-primary" : "text-muted-foreground"
            )}
          >
            <PawPrint className="w-4 h-4 mx-auto mb-1" />
            Thú cưng
          </button>
        </div>
      </div>

      {/* Main Content */}
      <main>
        {showCreateForm ? (
          <div className="container mx-auto px-4 py-8">
            <div className="mb-6">
              <Button variant="ghost" onClick={() => setShowCreateForm(false)} className="mb-4">
                ← Quay lại
              </Button>
              <h1 className="text-3xl font-bold text-center mb-2">Tạo hồ sơ thú cưng</h1>
              <p className="text-muted-foreground text-center">Điền thông tin để bắt đầu tìm bạn đời cho bé</p>
            </div>
            <PetProfileForm onComplete={() => setShowCreateForm(false)} />
          </div>
        ) : activeTab === "discover" ? (
          <PetDiscovery userPets={samplePets.slice(0, 2)} />
        ) : activeTab === "favorites" ? (
          <div className="container mx-auto px-4 py-16 text-center">
            <div className="w-20 h-20 mx-auto mb-6 bg-muted rounded-full flex items-center justify-center">
              <Heart className="w-10 h-10 text-muted-foreground" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Danh sách yêu thích trống</h2>
            <p className="text-muted-foreground mb-6">Nhấn vào trái tim để lưu các bé bạn quan tâm</p>
            <Button onClick={() => setActiveTab("discover")}>Khám phá ngay</Button>
          </div>
        ) : (
          <div className="container mx-auto px-4 py-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">Thú cưng của tôi</h2>
              <Button onClick={() => setShowCreateForm(true)} className="gap-2">
                <Plus className="w-4 h-4" />
                Thêm mới
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {samplePets.slice(0, 2).map((pet) => (
                <div
                  key={pet.id}
                  className="bg-card rounded-xl border overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                >
                  <div className="aspect-video overflow-hidden">
                    <img
                      src={pet.avatar || "/placeholder.svg"}
                      alt={pet.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-4">
                    <h3 className="font-bold text-lg">{pet.name}</h3>
                    <p className="text-sm text-muted-foreground">{pet.breed}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {pet.gender === "male" ? "♂ Đực" : "♀ Cái"} • {pet.weight} kg
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
