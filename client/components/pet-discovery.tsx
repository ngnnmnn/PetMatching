"use client"

import { useState, useCallback } from "react"
import { motion, useMotionValue, useTransform, AnimatePresence, PanInfo } from "framer-motion"
import { Dog, Cat, MapPin, Heart, Scale, Calendar, BadgeCheck, X, Undo2, Star, ChevronLeft, ChevronRight, Info, SlidersHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import { Pet, samplePets, dogBreeds, catBreeds, provinces, calculateAge, formatPrice } from "@/lib/pet-data"

interface PetDiscoveryProps {
  userPets?: Pet[]
  onMatch?: (pet: Pet) => void
}

export function PetDiscovery({ userPets = samplePets.slice(0, 2), onMatch }: PetDiscoveryProps) {
  const [selectedUserPet, setSelectedUserPet] = useState<Pet | null>(userPets[0] || null)
  const [filters, setFilters] = useState({
    species: "" as "dog" | "cat" | "",
    breed: "",
    location: "",
    weightRange: [0, 50] as [number, number],
    priceRange: [0, 20000000] as [number, number],
    verifiedOnly: false,
    hasPedigreeOnly: false,
  })
  const [currentIndex, setCurrentIndex] = useState(0)
  const [swipedPets, setSwipedPets] = useState<{ pet: Pet; direction: "left" | "right" }[]>([])
  const [likedPets, setLikedPets] = useState<Pet[]>([])
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)

  // Auto-set opposite gender filter when user selects their pet
  const oppositeGender = selectedUserPet?.gender === "male" ? "female" : "male"

  const filteredPets = samplePets.filter((pet) => {
    if (selectedUserPet && pet.gender !== oppositeGender) return false
    if (selectedUserPet && pet.species !== selectedUserPet.species) return false
    if (filters.breed && filters.breed !== "all" && pet.breed !== filters.breed) return false
    if (filters.location && filters.location !== "all" && pet.location !== filters.location) return false
    if (pet.weight < filters.weightRange[0] || pet.weight > filters.weightRange[1]) return false
    if (filters.verifiedOnly && !pet.verified) return false
    if (filters.hasPedigreeOnly && !pet.hasPedigree) return false
    return true
  })

  const breeds = selectedUserPet?.species === "dog" ? dogBreeds : selectedUserPet?.species === "cat" ? catBreeds : []
  const currentPet = filteredPets[currentIndex]
  const nextPet = filteredPets[currentIndex + 1]

  const handleSwipe = useCallback((direction: "left" | "right") => {
    if (!currentPet) return

    setSwipedPets((prev) => [...prev, { pet: currentPet, direction }])
    
    if (direction === "right") {
      setLikedPets((prev) => [...prev, currentPet])
      onMatch?.(currentPet)
    }

    setCurrentIndex((prev) => prev + 1)
    setCurrentImageIndex(0)
    setShowDetails(false)
  }, [currentPet, onMatch])

  const handleUndo = () => {
    if (swipedPets.length === 0) return
    const lastSwiped = swipedPets[swipedPets.length - 1]
    setSwipedPets((prev) => prev.slice(0, -1))
    if (lastSwiped.direction === "right") {
      setLikedPets((prev) => prev.filter((p) => p.id !== lastSwiped.pet.id))
    }
    setCurrentIndex((prev) => prev - 1)
  }

  const FilterPanel = () => (
    <div className="space-y-6">
      {/* Select User's Pet */}
      <div className="space-y-3">
        <Label className="text-sm font-semibold">Chon Pet cua ban</Label>
        <Select
          value={selectedUserPet?.id || ""}
          onValueChange={(value) => {
            const pet = userPets.find((p) => p.id === value)
            setSelectedUserPet(pet || null)
            setFilters({ ...filters, breed: "" })
            setCurrentIndex(0)
            setSwipedPets([])
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Chon be cua ban" />
          </SelectTrigger>
          <SelectContent>
            {userPets.map((pet) => (
              <SelectItem key={pet.id} value={pet.id}>
                <div className="flex items-center gap-2">
                  {pet.species === "dog" ? <Dog className="w-4 h-4" /> : <Cat className="w-4 h-4" />}
                  <span>{pet.name}</span>
                  <span className="text-muted-foreground text-xs">({pet.gender === "male" ? "Duc" : "Cai"})</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedUserPet && (
          <div className="p-3 rounded-lg bg-primary/10 text-sm">
            <p className="text-muted-foreground">
              Dang tim kiem <span className="font-semibold text-primary">{selectedUserPet.species === "dog" ? "cho" : "meo"}</span>{" "}
              <span className="font-semibold text-primary">{oppositeGender === "male" ? "duc" : "cai"}</span> cho be{" "}
              <span className="font-semibold text-foreground">{selectedUserPet.name}</span>
            </p>
          </div>
        )}
      </div>

      {/* Breed Filter */}
      <div className="space-y-3">
        <Label className="text-sm font-semibold">Giong</Label>
        <Select
          value={filters.breed}
          onValueChange={(value) => {
            setFilters({ ...filters, breed: value })
            setCurrentIndex(0)
            setSwipedPets([])
          }}
          disabled={!selectedUserPet}
        >
          <SelectTrigger>
            <SelectValue placeholder="Tat ca giong" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tat ca giong</SelectItem>
            {breeds.map((breed) => (
              <SelectItem key={breed} value={breed}>
                {breed}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Location Filter */}
      <div className="space-y-3">
        <Label className="text-sm font-semibold">Khu vuc</Label>
        <Select 
          value={filters.location} 
          onValueChange={(value) => {
            setFilters({ ...filters, location: value })
            setCurrentIndex(0)
            setSwipedPets([])
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Tat ca khu vuc" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tat ca khu vuc</SelectItem>
            {provinces.map((province) => (
              <SelectItem key={province} value={province}>
                {province}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Weight Range */}
      <div className="space-y-3">
        <Label className="text-sm font-semibold">
          Can nang: {filters.weightRange[0]} - {filters.weightRange[1]} kg
        </Label>
        <Slider
          value={filters.weightRange}
          onValueChange={(value) => setFilters({ ...filters, weightRange: value as [number, number] })}
          min={0}
          max={50}
          step={1}
          className="py-2"
        />
      </div>

      {/* Checkbox Filters */}
      <div className="space-y-3">
        <label className="flex items-center gap-3 cursor-pointer">
          <Checkbox
            checked={filters.verifiedOnly}
            onCheckedChange={(checked) => {
              setFilters({ ...filters, verifiedOnly: checked as boolean })
              setCurrentIndex(0)
              setSwipedPets([])
            }}
          />
          <span className="text-sm">Chi hien da xac minh</span>
        </label>
        <label className="flex items-center gap-3 cursor-pointer">
          <Checkbox
            checked={filters.hasPedigreeOnly}
            onCheckedChange={(checked) => {
              setFilters({ ...filters, hasPedigreeOnly: checked as boolean })
              setCurrentIndex(0)
              setSwipedPets([])
            }}
          />
          <span className="text-sm">Co giay pha he</span>
        </label>
      </div>

      {/* Reset Filters */}
      <Button
        variant="outline"
        className="w-full"
        onClick={() => {
          setFilters({
            species: "",
            breed: "",
            location: "",
            weightRange: [0, 50],
            priceRange: [0, 20000000],
            verifiedOnly: false,
            hasPedigreeOnly: false,
          })
          setCurrentIndex(0)
          setSwipedPets([])
        }}
      >
        Dat lai bo loc
      </Button>

      {/* Stats */}
      <div className="pt-4 border-t space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Da thich</span>
          <span className="font-semibold text-primary">{likedPets.length}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Con lai</span>
          <span className="font-semibold">{Math.max(0, filteredPets.length - currentIndex)}</span>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                {selectedUserPet?.species === "dog" ? (
                  <Dog className="w-5 h-5 text-primary" />
                ) : (
                  <Cat className="w-5 h-5 text-primary" />
                )}
              </div>
              <div>
                <h1 className="font-bold text-lg">PetMatch</h1>
                <p className="text-xs text-muted-foreground">
                  {filteredPets.length - currentIndex} ban ghep doi dang cho
                </p>
              </div>
            </div>

            {/* Mobile Filter Button */}
            <Sheet open={mobileFilterOpen} onOpenChange={setMobileFilterOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="lg:hidden">
                  <SlidersHorizontal className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80 overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Bo loc tim kiem</SheetTitle>
                </SheetHeader>
                <div className="mt-6">
                  <FilterPanel />
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <div className="flex gap-6">
          {/* Sidebar - Desktop */}
          <aside className="hidden lg:block w-72 shrink-0">
            <div className="sticky top-24 p-5 bg-card rounded-xl border shadow-sm">
              <h3 className="font-bold text-lg mb-4">Bo loc tim kiem</h3>
              <FilterPanel />
            </div>
          </aside>

          {/* Main Content - Swipe Cards */}
          <main className="flex-1 flex flex-col items-center">
            {/* Card Stack */}
            <div className="relative w-full max-w-sm h-[520px] mb-6">
              {currentPet ? (
                <>
                  {/* Next card (background) */}
                  {nextPet && (
                    <div className="absolute inset-0 scale-95 opacity-50">
                      <PetSwipeCard pet={nextPet} isBackground />
                    </div>
                  )}
                  
                  {/* Current card */}
                  <AnimatePresence mode="popLayout">
                    <SwipeableCard
                      key={currentPet.id}
                      pet={currentPet}
                      onSwipe={handleSwipe}
                      showDetails={showDetails}
                      setShowDetails={setShowDetails}
                      currentImageIndex={currentImageIndex}
                      setCurrentImageIndex={setCurrentImageIndex}
                    />
                  </AnimatePresence>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="w-24 h-24 mb-6 bg-muted rounded-full flex items-center justify-center">
                    <Heart className="w-12 h-12 text-muted-foreground" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Het roi!</h3>
                  <p className="text-muted-foreground mb-4">
                    Ban da xem het tat ca cac ban ghep doi
                  </p>
                  <Button
                    onClick={() => {
                      setCurrentIndex(0)
                      setSwipedPets([])
                    }}
                  >
                    Xem lai tu dau
                  </Button>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            {currentPet && (
              <div className="flex items-center justify-center gap-4">
                <Button
                  variant="outline"
                  size="icon"
                  className="w-12 h-12 rounded-full border-2"
                  onClick={handleUndo}
                  disabled={swipedPets.length === 0}
                >
                  <Undo2 className="w-5 h-5 text-muted-foreground" />
                </Button>
                
                <Button
                  variant="outline"
                  size="icon"
                  className="w-16 h-16 rounded-full border-2 border-destructive hover:bg-destructive/10"
                  onClick={() => handleSwipe("left")}
                >
                  <X className="w-8 h-8 text-destructive" />
                </Button>

                <Button
                  variant="outline"
                  size="icon"
                  className="w-16 h-16 rounded-full border-2 border-accent hover:bg-accent/10"
                  onClick={() => handleSwipe("right")}
                >
                  <Heart className="w-8 h-8 text-accent" />
                </Button>

                <Button
                  variant="outline"
                  size="icon"
                  className="w-12 h-12 rounded-full border-2"
                  onClick={() => setShowDetails(!showDetails)}
                >
                  <Info className="w-5 h-5 text-primary" />
                </Button>
              </div>
            )}

            {/* Swipe Instructions */}
            {currentPet && (
              <p className="text-sm text-muted-foreground mt-6 text-center">
                Vuot trai de bo qua, vuot phai de thich
              </p>
            )}
          </main>
        </div>
      </div>
    </div>
  )
}

interface SwipeableCardProps {
  pet: Pet
  onSwipe: (direction: "left" | "right") => void
  showDetails: boolean
  setShowDetails: (show: boolean) => void
  currentImageIndex: number
  setCurrentImageIndex: (index: number) => void
}

function SwipeableCard({ 
  pet, 
  onSwipe, 
  showDetails, 
  setShowDetails,
  currentImageIndex,
  setCurrentImageIndex 
}: SwipeableCardProps) {
  const x = useMotionValue(0)
  const rotate = useTransform(x, [-200, 200], [-25, 25])
  const likeOpacity = useTransform(x, [0, 100], [0, 1])
  const nopeOpacity = useTransform(x, [-100, 0], [1, 0])

  const handleDragEnd = (_: any, info: PanInfo) => {
    if (info.offset.x > 100) {
      onSwipe("right")
    } else if (info.offset.x < -100) {
      onSwipe("left")
    }
  }

  const images = pet.gallery?.length ? pet.gallery : [pet.avatar || "/placeholder.svg"]

  return (
    <motion.div
      className="absolute inset-0 cursor-grab active:cursor-grabbing"
      style={{ x, rotate }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.9}
      onDragEnd={handleDragEnd}
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ 
        x: x.get() > 0 ? 300 : -300,
        opacity: 0,
        transition: { duration: 0.2 }
      }}
    >
      <div className="relative w-full h-full bg-card rounded-2xl shadow-xl overflow-hidden border">
        {/* Like/Nope Overlays */}
        <motion.div
          className="absolute top-8 left-6 z-20 px-4 py-2 border-4 border-accent text-accent rounded-lg font-bold text-2xl -rotate-12"
          style={{ opacity: likeOpacity }}
        >
          THICH
        </motion.div>
        <motion.div
          className="absolute top-8 right-6 z-20 px-4 py-2 border-4 border-destructive text-destructive rounded-lg font-bold text-2xl rotate-12"
          style={{ opacity: nopeOpacity }}
        >
          BO QUA
        </motion.div>

        {/* Image Gallery */}
        <div className="relative h-[65%] overflow-hidden">
          <img
            src={images[currentImageIndex]}
            alt={pet.name}
            className="w-full h-full object-cover"
            draggable={false}
          />
          
          {/* Image Navigation */}
          {images.length > 1 && (
            <>
              {/* Image Indicators */}
              <div className="absolute top-3 left-0 right-0 flex justify-center gap-1.5 px-4">
                {images.map((_, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "h-1 rounded-full flex-1 max-w-12 transition-colors",
                      idx === currentImageIndex ? "bg-white" : "bg-white/40"
                    )}
                  />
                ))}
              </div>

              {/* Navigation Buttons */}
              <button
                className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/30 flex items-center justify-center text-white"
                onClick={(e) => {
                  e.stopPropagation()
                  setCurrentImageIndex((currentImageIndex - 1 + images.length) % images.length)
                }}
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/30 flex items-center justify-center text-white"
                onClick={(e) => {
                  e.stopPropagation()
                  setCurrentImageIndex((currentImageIndex + 1) % images.length)
                }}
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </>
          )}

          {/* Badges */}
          <div className="absolute bottom-3 left-3 flex gap-2">
            {pet.verified && (
              <Badge className="bg-accent text-accent-foreground gap-1">
                <BadgeCheck className="w-3 h-3" />
                Da xac minh
              </Badge>
            )}
            {pet.hasPedigree && (
              <Badge variant="secondary" className="gap-1">
                Co pha he
              </Badge>
            )}
          </div>
        </div>

        {/* Pet Info */}
        <div className="p-4 h-[35%] overflow-y-auto">
          <div className="flex items-start justify-between mb-2">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                {pet.name}
                <Badge variant={pet.gender === "male" ? "default" : "secondary"} className="text-xs">
                  {pet.gender === "male" ? "Duc" : "Cai"}
                </Badge>
              </h2>
              <p className="text-muted-foreground">{pet.breed}</p>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="flex flex-wrap gap-3 mb-3 text-sm">
            <span className="flex items-center gap-1 text-muted-foreground">
              <Calendar className="w-4 h-4" />
              {calculateAge(pet.birthday)}
            </span>
            <span className="flex items-center gap-1 text-muted-foreground">
              <Scale className="w-4 h-4" />
              {pet.weight} kg
            </span>
            <span className="flex items-center gap-1 text-muted-foreground">
              <MapPin className="w-4 h-4" />
              {pet.location}
            </span>
          </div>

          {/* Breeding Option */}
          <div className="mb-3">
            {pet.breedingOption === "cash" && pet.breedingPrice && (
              <span className="text-primary font-bold text-lg">{formatPrice(pet.breedingPrice)}</span>
            )}
            {pet.breedingOption === "share" && (
              <span className="text-accent font-semibold">Chia san pham</span>
            )}
            {pet.breedingOption === "negotiate" && (
              <span className="text-muted-foreground">Thoa thuan sau</span>
            )}
          </div>

          {/* Expanded Details */}
          {showDetails && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="border-t pt-3 mt-2"
            >
              {pet.description && (
                <p className="text-sm text-muted-foreground mb-3">{pet.description}</p>
              )}
              
              {/* Owner Info */}
              <div className="flex items-center gap-2">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={pet.ownerAvatar} />
                  <AvatarFallback>{pet.ownerName[0]}</AvatarFallback>
                </Avatar>
                <span className="text-sm text-muted-foreground">{pet.ownerName}</span>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

interface PetSwipeCardProps {
  pet: Pet
  isBackground?: boolean
}

function PetSwipeCard({ pet, isBackground }: PetSwipeCardProps) {
  return (
    <div className={cn(
      "w-full h-full bg-card rounded-2xl shadow-lg overflow-hidden border",
      isBackground && "pointer-events-none"
    )}>
      <div className="relative h-[65%] overflow-hidden">
        <img
          src={pet.avatar || "/placeholder.svg"}
          alt={pet.name}
          className="w-full h-full object-cover"
        />
      </div>
      <div className="p-4">
        <h2 className="text-2xl font-bold">{pet.name}</h2>
        <p className="text-muted-foreground">{pet.breed}</p>
      </div>
    </div>
  )
}
