"use client"

import { useEffect, useMemo } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { HelpCircle, Pause, Play, Settings, Star } from "lucide-react"
import TokenCard from "./token-card"
import Header from "./header"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { useLocalStorage } from "@/hooks/use-local-storage"
import { useTheme } from "next-themes"
import NextImage from "next/image"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import DonationButton from "./donation-button"
import { Toaster } from "@/components/ui/toaster"
import { db } from "@/lib/db"
import { OnboardingGuide } from "./onboarding/onboarding-guide"
import { useOnboardingStore } from "./onboarding/onboarding-store"
import { ChatBubble } from "./pi-bot/chat-bubble"
import { useTokenContext } from "@/contexts/token-context"
import { AlertSettingsModal } from "./alert-settings-modal"

// Add this to the imports at the top
import { AlertManagement } from "./alert-management"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

// Import custom hooks
// import { useWebSocketTrades } from "@/hooks/use-websocket-trades"; // Removed as it's in TokenProvider
import { useTokenProcessing } from "@/hooks/use-token-processing"
import { useTokenFiltering } from "@/hooks/use-token-filtering"
import { usePagination } from "@/hooks/use-pagination"
import { useSettings } from "@/hooks/use-settings"
import { useTradeCleanup } from "@/hooks/use-trade-cleanup"
import { usePiBotData } from "@/hooks/use-pi-bot-data"
import { useAlertChecker } from "@/hooks/use-alert-checker"
import { toast } from "sonner"

export default function Dashboard() {
  // Get values from context
  const {
    tokens,
    setTokens,
    allTrades,
    setAllTrades,
    solPrice,
    isLoading,
    showFavorites,
    setShowFavorites,
    isPaused,
    setIsPaused,
    renderKey,
    setRenderKey,
    favorites, // Access favorites from the context
  } = useTokenContext()

  // Use localStorage for timeRange and sortBy to persist user preferences
  const [timeRange, setTimeRange] = useLocalStorage<string>("pump-investments-time-range", "10")
  const [sortBy, setSortBy] = useLocalStorage<string>("pump-investments-sort-by", "marketCap")

  // Onboarding state
  const { isOnboardingActive, setOnboardingActive } = useOnboardingStore()

  // Get theme from next-themes
  const { theme } = useTheme()

  // Use settings hook
  const { settings, updateSettings, restartOnboarding } = useSettings(setOnboardingActive)

  // Use token processing hook
  useTokenProcessing({
    allTrades,
    timeRange,
    solPrice,
    minTradeAmountFilter: settings.minTradeAmountFilter,
    setTokens,
    setRenderKey,
  })

  // Use token filtering hook
  const sortedTokens = useTokenFiltering({
    tokens,
    sortBy,
    settings,
    showFavorites,
    favorites,
    isPaused,
    renderKey,
  })

  // Use pagination hook with explicit dependencies for page reset
  const { currentPage, setCurrentPage, totalPages, paginatedItems } = usePagination({
    items: sortedTokens,
    itemsPerPage: settings.tokensPerPage,
    isPaused,
    dependencies: [
      sortBy,
      settings.minMarketCap,
      settings.maxMarketCap,
      settings.minTotalVolume,
      settings.maxTotalVolume,
      settings.minBuyVolume,
      settings.maxBuyVolume,
      settings.minSellVolume,
      settings.maxSellVolume,
      settings.minUniqueTraders,
      settings.maxUniqueTraders,
      settings.hideKOTH,
      settings.hideExternal,
      settings.minMarketCapFilter,
      settings.minUniqueTraderCountFilter,
      settings.minTradeAmountFilter,
      showFavorites,
    ],
  })

  // Use trade cleanup hook
  useTradeCleanup({
    tradeRetentionMinutes: settings.tradeRetentionMinutes,
    setAllTrades,
  })

  // Use PI Bot data hook
  usePiBotData({
    paginatedTokens: paginatedItems,
    solPrice,
    timeRange,
    sortBy,
  })

  // Use alert checker hook
  useAlertChecker(tokens)

  // Check if onboarding should be shown
  useEffect(() => {
    const checkOnboardingStatus = async () => {
      const hasCompleted = await db.hasCompletedOnboarding()
      setOnboardingActive(!hasCompleted)
    }

    checkOnboardingStatus()
  }, [setOnboardingActive])

  // Clean up alerts for non-favorite tokens
  useEffect(() => {
    const cleanupAlerts = async () => {
      await db.removeAllAlertsForNonFavorites()
    }

    cleanupAlerts()
  }, [favorites])

  const tokenCards = useMemo(() => {
    return paginatedItems.map((token, index) => (
      <div
        key={`${token.mint}-${renderKey}`}
        data-onboarding={index === 4 ? "token-card" : undefined}
        id={index === 4 ? "featured-token-card" : undefined}
      >
        <TokenCard
          token={token}
          size="medium"
          showAlertSettings={showFavorites} // Only show alert settings in favorites view
          showBonkBotLogo={settings.showBonkBotLogo} // Pass BonkBot setting to TokenCard
        />
      </div>
    ))
  }, [paginatedItems, renderKey, showFavorites, settings.showBonkBotLogo])

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header />
        <div className="container mx-auto px-4 py-6 flex items-center justify-center h-[50vh]">
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-2">Loading data...</h2>
            <p className="text-muted-foreground">Please wait while we fetch the latest token information</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header />

      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-[120px]" data-onboarding="time-range">
                <SelectValue placeholder="Time Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 min</SelectItem>
                <SelectItem value="2">2 min</SelectItem>
                <SelectItem value="5">5 min</SelectItem>
                <SelectItem value="10">10 min</SelectItem>
                <SelectItem value="15">15 min</SelectItem>
                <SelectItem value="30">30 min</SelectItem>
                <SelectItem value="60">60 min</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[150px]" data-onboarding="sort-by">
                <SelectValue placeholder="Sort By" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="marketCap">Market Cap</SelectItem>
                <SelectItem value="totalVolume">Total Volume</SelectItem>
                <SelectItem value="buyVolume">Buy Volume</SelectItem>
                <SelectItem value="sellVolume">Sell Volume</SelectItem>
                <SelectItem value="uniqueTraders">Unique Traders</SelectItem>
                <SelectItem value="tokenAge">Token Age</SelectItem>
                <SelectItem value="lastTrade">Last Trade</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="icon"
              onClick={() => setIsPaused(!isPaused)}
              className="ml-2"
              data-onboarding="pause-button"
              title={isPaused ? "Resume auto-sorting" : "Pause auto-sorting"}
            >
              {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            </Button>
            <div className="relative" data-onboarding="favorites-button">
              <Button
                variant={showFavorites ? "default" : "outline"}
                size="icon"
                onClick={() => setShowFavorites(!showFavorites)}
                className="ml-2"
                title={showFavorites ? "Show all tokens" : "Show favorites only"}
              >
                <Star className={`h-4 w-4 ${showFavorites ? "fill-yellow-400" : ""}`} />
              </Button>
              {favorites.length > 0 && (
                <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {favorites.length}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4 w-full md:w-auto">
            <DonationButton address="8oRZGW7wDEkmxMWhRo7eaQes4zR1smh9Q1wDwiDaCKnx" />

            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" data-onboarding="settings-button">
                  <Settings className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent className="overflow-y-auto max-h-screen pb-20">
                <SheetHeader>
                  <SheetTitle>Settings</SheetTitle>
                  <SheetDescription>Customize your Pump.Investments experience</SheetDescription>
                  <p className="text-xs text-muted-foreground mt-1 mb-4">
                    Scroll down to see all settings including alert management
                  </p>
                </SheetHeader>

                <div className="py-4 space-y-6">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Tokens Per Page: {settings.tokensPerPage}</Label>
                    </div>
                    <Slider
                      value={[settings.tokensPerPage]}
                      min={4}
                      max={48}
                      step={4}
                      onValueChange={(value) => updateSettings("tokensPerPage", value[0])}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Filters</Label>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <NextImage
                            src="/koth.png"
                            alt="King of the Hill"
                            width={40}
                            height={40}
                            className="object-contain"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement
                              target.style.display = "none"
                            }}
                          />
                          <Label htmlFor="hide-koth">Hide KOTH</Label>
                        </div>
                        <Switch
                          id="hide-koth"
                          checked={settings.hideKOTH}
                          onCheckedChange={(checked) => updateSettings("hideKOTH", checked)}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <NextImage
                            src="/not-from-pump.png"
                            alt="Not from pump.fun"
                            width={16}
                            height={16}
                            className="object-contain"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement
                              target.style.display = "none"
                            }}
                          />
                          <Label htmlFor="hide-external">Hide External</Label>
                        </div>
                        <Switch
                          id="hide-external"
                          checked={settings.hideExternal}
                          onCheckedChange={(checked) => updateSettings("hideExternal", checked)}
                        />
                      </div>
                    </div>
                  </div>

                  {/* BonkBot Logo Setting */}
                  <div className="space-y-2">
                    <Label>Integrations</Label>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <NextImage
                            src="/bonkbot.png"
                            alt="BonkBot"
                            width={24}
                            height={24}
                            className="object-contain"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement
                              target.style.display = "none"
                            }}
                          />
                          <Label htmlFor="show-bonkbot-logo">Show BonkBot Logo</Label>
                        </div>
                        <Switch
                          id="show-bonkbot-logo"
                          checked={settings.showBonkBotLogo}
                          onCheckedChange={(checked) => updateSettings("showBonkBotLogo", checked)}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Display BonkBot logo on token cards for quick trading access
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 mt-4">
                  <Label>Minimum Market Cap: ${settings.minMarketCapFilter.toLocaleString()}</Label>
                  <Slider
                    value={[settings.minMarketCapFilter]}
                    min={0}
                    max={100000}
                    step={1000}
                    onValueChange={(value) => updateSettings("minMarketCapFilter", value[0])}
                  />
                </div>

                <div className="space-y-2 mt-4">
                  <Label>Minimum Unique Traders: {settings.minUniqueTraderCountFilter}</Label>
                  <Slider
                    value={[settings.minUniqueTraderCountFilter]}
                    min={1}
                    max={100}
                    step={1}
                    onValueChange={(value) => updateSettings("minUniqueTraderCountFilter", value[0])}
                  />
                </div>

                <div className="space-y-2 mt-4">
                  <Label>Minimum Trade Amount: ${settings.minTradeAmountFilter}</Label>
                  <Slider
                    value={[settings.minTradeAmountFilter]}
                    min={0}
                    max={100}
                    step={1}
                    onValueChange={(value) => updateSettings("minTradeAmountFilter", value[0])}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Only count traders with individual trades above this amount
                  </p>
                </div>

                <div className="space-y-2 mt-6 border-t pt-4">
                  <div className="flex items-center justify-between">
                    <Label>Trade Retention Period</Label>
                    <span className="text-sm font-medium">
                      {settings.tradeRetentionMinutes < 60
                        ? `${settings.tradeRetentionMinutes} minutes`
                        : settings.tradeRetentionMinutes === 60
                          ? "1 hour"
                          : settings.tradeRetentionMinutes === 1440
                            ? "1 day"
                            : settings.tradeRetentionMinutes === 10080
                              ? "1 week"
                              : settings.tradeRetentionMinutes >= 1440
                                ? `${(settings.tradeRetentionMinutes / 1440).toFixed(1)} days`
                                : `${(settings.tradeRetentionMinutes / 60).toFixed(1)} hours`}
                    </span>
                  </div>

                  {/* Simple slider with no additional marks or labels */}
                  <Slider
                    value={[settings.tradeRetentionMinutes]}
                    min={10}
                    max={10080} // 1 week
                    step={10}
                    onValueChange={(value) => updateSettings("tradeRetentionMinutes", value[0])}
                    className="my-4"
                  />

                  <div className="mt-2 text-xs text-amber-500 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 p-2 rounded-md">
                    <p className="font-medium mb-1">⚠️ Warning:</p>
                    <p>
                      Longer retention periods will use more browser storage and memory. This may impact performance on
                      devices with limited resources.
                    </p>
                    <p className="mt-1">
                      Note: The app must be open in your browser to collect trade data. Trades will be stored locally
                      for the duration you set.
                    </p>
                  </div>
                </div>

                {/* Alert Management */}
                <div className="mt-8 border-t pt-4">
                  <h3 className="text-sm font-medium mb-4">Alert Management</h3>
                  <AlertManagement />
                </div>

                {/* Onboarding Guide Restart Button - MOVED HERE */}
                <div className="mt-8 border-t pt-4">
                  <h3 className="text-sm font-medium mb-2">Help & Guidance</h3>
                  <Button
                    onClick={restartOnboarding}
                    variant="outline"
                    className="w-full flex items-center justify-center gap-2"
                  >
                    <HelpCircle className="h-4 w-4" />
                    Restart Onboarding Guide
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2">Take the tour again to learn about all features</p>
                </div>

                {/* Reset All Settings */}
                <div className="mt-8 border-t pt-4">
                  <h3 className="text-sm font-medium mb-2">Reset Settings</h3>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" className="w-full">
                        Reset All Settings
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will reset all settings to their default values, delete all alerts, and remove all
                          favorites. Alert history will be preserved. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={async () => {
                            try {
                              await db.resetAllSettings()

                              // Reset UI state
                              setShowFavorites(false)

                              // Force a re-render
                              setRenderKey((prev) => prev + 1)

                              toast({
                                title: "Settings Reset",
                                description: "All settings have been reset to their default values.",
                              })
                            } catch (error) {
                              console.error("Error resetting settings:", error)
                              toast({
                                title: "Error",
                                description: "Failed to reset settings.",
                                variant: "destructive",
                              })
                            }
                          }}
                        >
                          Reset All
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  <p className="text-xs text-muted-foreground mt-2">
                    This will reset all settings, delete all alerts, and remove all favorites. Alert history will be
                    preserved.
                  </p>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {tokenCards}

          {sortedTokens.length === 0 && (
            <div className="col-span-full text-center py-12">
              <h3 className="text-xl font-semibold mb-2">No tokens found</h3>
              {showFavorites && favorites.length === 0 ? (
                <p className="text-muted-foreground">
                  You haven't added any favorites yet. Click the star icon on a token to add it to your favorites.
                </p>
              ) : (
                <p className="text-muted-foreground">Waiting for new trades or adjust your filters...</p>
              )}
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <Pagination className="mt-8" data-onboarding="pagination">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>

              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number

                if (totalPages <= 5) {
                  // Show all pages if 5 or fewer
                  pageNum = i + 1
                } else if (currentPage <= 3) {
                  // Near the start
                  pageNum = i + 1
                  if (i === 4)
                    return (
                      <PaginationItem key="ellipsis-end">
                        <PaginationEllipsis />
                      </PaginationItem>
                    )
                } else if (currentPage >= totalPages - 2) {
                  // Near the end
                  pageNum = totalPages - 4 + i
                  if (i === 0)
                    return (
                      <PaginationItem key="ellipsis-start">
                        <PaginationEllipsis />
                      </PaginationItem>
                    )
                } else {
                  // In the middle
                  if (i === 0)
                    return (
                      <PaginationItem key="ellipsis-start">
                        <PaginationEllipsis />
                      </PaginationItem>
                    )
                  if (i === 4)
                    return (
                      <PaginationItem key="ellipsis-end">
                        <PaginationEllipsis />
                      </PaginationItem>
                    )
                  pageNum = currentPage + i - 2
                }

                return (
                  <PaginationItem key={pageNum}>
                    <PaginationLink isActive={currentPage === pageNum} onClick={() => setCurrentPage(pageNum)}>
                      {pageNum}
                    </PaginationLink>
                  </PaginationItem>
                )
              })}

              <PaginationItem>
                <PaginationNext
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                  className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        )}
      </div>

      {/* Onboarding Guide */}
      {isOnboardingActive && <OnboardingGuide />}

      {/* Add Toaster for notifications */}
      <Toaster />
      {/* PI Bot Chat Bubble */}
      <ChatBubble />

      {/* Add the Alert Settings Modal */}
      <AlertSettingsModal />
    </div>
  )
}
